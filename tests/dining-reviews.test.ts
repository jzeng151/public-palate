import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDiningReviews, openTableSource, tripadvisorSource } from '../lib/dining-reviews.ts';
import { analysisSchema, isPlatformUrl, validateAnalysis, type PipelineEvent } from '../lib/review-model.ts';
import type { Restaurant } from '../lib/restaurant-data.ts';

// Synthetic fixtures mirror records verified in live Nimble captures. No real review text.
const restaurant:Restaurant={id:'fixture',name:'Test Kitchen Restaurant',address:'234 West 44 Street',zip:'10036',borough:'Manhattan',cuisine:'American',grade:'A',gradeDate:null,inspectionDate:null,recordDate:null};
const otUrl='https://www.opentable.com/restaurant/profile/1703';
const taUrl='https://www.tripadvisor.com/Restaurant_Review-g60763-d12345-Reviews-Test_Kitchen-New_York.html';
const review={reviewId:'OT-1703-123',text:'Synthetic diner text with a good meal.',rating:{food:2,service:3,overall:5},user:{nickname:'Fixture diner'},submittedDateTime:'2026-01-02',type:'OPENTABLEVERIFIED',publicRestaurantReply:{text:'Synthetic owner reply'}};
function otPage(options:{street?:string;zip?:string;name?:string;reviews?:unknown[];basis?:string}={}){
  const restaurantProfile={restaurant:{restaurantId:1703,name:options.name||'Test Kitchen',address:{line1:options.street||'234 West 44th Street',postCode:options.zip||'10036'},statistics:{reviews:{allTimeTextReviewCount:6000,ratingBasedOn:options.basis||'RecentReviews',ratings:{overall:{rating:4.8}}}}},reviewsData:{reviewSearchResults:{reviews:options.reviews||[review]}}};
  return `<script id="primary-window-vars">${JSON.stringify({windowVariables:{__INITIAL_STATE__:{restaurantProfile}}})}</script><script type="application/ld+json">${JSON.stringify({'@type':'Review',reviewRating:{ratingValue:2}})}</script>`;
}
function taPage(options:{street?:string;zip?:string;cleanId?:number;empty?:boolean}={}){
  const business={'@type':'FoodEstablishment','@id':taUrl,name:'Test Kitchen',address:{streetAddress:options.street||'234 West 44th Street',postalCode:options.zip||'10036'},aggregateRating:{ratingValue:4.3,reviewCount:217}};
  const bootstrap={urqlSsrData:{results:{fixture:{data:JSON.stringify({locations:[{locationId:options.cleanId,localizedStreetAddress:{street1:'234 West 44th Street',postalCode:'10036'}}]})}}}};
  const script=`window.bootstrap = JSON.parse(${JSON.stringify(JSON.stringify(bootstrap))})`;
  return `<script type="application/ld+json">${JSON.stringify({'@graph':[business]})}</script>${options.cleanId?`<script src="data:text/javascript,${encodeURIComponent(script)}"></script>`:''}${options.empty?'':`<div data-automation="reviewCard"><a href="/Profile/fixture">Fixture diner</a><div data-test-target="review-title"><a href="/ShowUserReviews-g60763-d12345-r789-Test_Kitchen.html">Title</a></div><div data-automation="bubbleRatingImage"><svg><title>4 of 5 bubbles</title></svg></div><div data-test-target="review-body">Synthetic Tripadvisor meal review.<button>Read more</button></div><div>Written January 2, 2026</div><div data-automation="bubbleRatingImage"><svg><title>1 of 5 bubbles</title></svg></div></div>`}`;
}

test('OpenTable preserves explicit overall stars, original text, dates and rating basis',()=>{
  const result=openTableSource(restaurant,otUrl,otPage());
  assert.equal(result.structured!.reviews[0].rating,5,'ignore contradictory JSON-LD and category scores');
  assert.equal(result.structured!.reviews[0].text,review.text);
  assert.equal(result.structured!.reviews[0].date,'2026-01-02');
  assert.equal(result.structured!.platform.rating,4.8);
  assert.equal(result.structured!.platform.totalReviews,6000);
  assert.equal(result.structured!.platform.ratingBasis,'recent');
  assert.doesNotMatch(result.content,/Synthetic owner reply/);
  const fallback=validateAnalysis({platforms:[],reviews:[],summaries:[]},[result]);
  assert.equal(fallback.reviews.length,1);
  assert.equal(fallback.platforms.find(p=>p.platform==='OpenTable')?.ratingBasis,'recent');
});

test('OpenTable includes older open reviews but excludes other branches and previous concepts',()=>{
  const old={...review,reviewId:'OR-1703-456',submittedDateTime:'2019-01-01',type:'OPENREVIEW',rating:{overall:2}};
  const result=openTableSource(restaurant,otUrl,otPage({basis:'AllTime',reviews:[{...review,reviewId:'OT-999-123'},{...review,fromPreviousConcept:true},old,old]}));
  assert.equal(result.structured!.reviews.length,1);
  assert.equal(result.structured!.reviews[0].rating,2);
  assert.equal(result.structured!.reviews[0].date,'2019-01-01');
  assert.equal(result.structured!.platform.ratingBasis,'all_time');
  assert.throws(()=>openTableSource(restaurant,otUrl,otPage({street:'235 West 44th Street'})),/matching restaurant/);
  assert.throws(()=>openTableSource(restaurant,otUrl,otPage({zip:'10035'})),/matching restaurant/);
  assert.throws(()=>openTableSource(restaurant,otUrl,otPage({name:'Different Kitchen'})),/matching restaurant/);
  assert.throws(()=>openTableSource(restaurant,otUrl.replace('1703','999'),otPage()),/matching restaurant/);
});

test('Tripadvisor uses overall bubbles and excludes category stars and UI copy',()=>{
  const result=tripadvisorSource(restaurant,taUrl,taPage());
  const row=result.structured!.reviews[0];
  assert.equal(row.rating,4);assert.equal(row.id,'tripadvisor-789');assert.equal(row.author,'Fixture diner');
  assert.equal(row.text,'Synthetic Tripadvisor meal review.');assert.equal(row.date,'January 2, 2026');
  assert.equal(result.structured!.platform.rating,4.3);assert.equal(result.structured!.platform.totalReviews,217);
  assert.equal(validateAnalysis({platforms:[],reviews:[],summaries:[]},[result]).reviews.length,1);
  assert.throws(()=>tripadvisorSource(restaurant,taUrl,taPage({street:'235 West 44th Street'})),/matching restaurant/);
  assert.throws(()=>tripadvisorSource(restaurant,taUrl,taPage({zip:'10035'})),/matching restaurant/);
});

test('Tripadvisor cross-street cleanup must belong to the exact location ID',()=>{
  const options={street:'234 West 44th Street at the corner of Test Ave'};
  assert.equal(tripadvisorSource(restaurant,taUrl,taPage({...options,cleanId:12345})).structured!.reviews.length,1);
  assert.throws(()=>tripadvisorSource(restaurant,taUrl,taPage({...options,cleanId:54321})),/matching restaurant/);
  assert.throws(()=>tripadvisorSource(restaurant,taUrl,taPage({empty:true})),/no written reviews/);
});

test('restaurant URL rules reject lookalike hosts, photo/forum pages and OpenTable directories',()=>{
  for(const url of [taUrl,otUrl,'https://www.opentable.com/sardis','https://www.opentable.com/r/lilia-brooklyn'])assert.equal(isPlatformUrl(url,url.includes('tripadvisor')?'Tripadvisor':'OpenTable'),true);
  for(const url of [taUrl.replace('tripadvisor.com','tripadvisor.com.evil.example'),taUrl.replace('Restaurant_Review','ShowUserReviews'),'https://www.tripadvisor.com/Restaurants-g60763-New_York.html'])assert.equal(isPlatformUrl(url,'Tripadvisor'),false);
  for(const url of ['https://www.opentable.com/landmark/restaurants-near-test','https://www.opentable.com/r','https://www.opentable.com/s','https://www.opentable.com@evil.example/r/test'])assert.equal(isPlatformUrl(url,'OpenTable'),false);
});

test('OpenTable retries a timeout with vx10 and retains only verified reviews',async()=>{
  const bodies:unknown[]=[],events:PipelineEvent[]=[];
  const request:Parameters<typeof collectDiningReviews>[3]=async <T>(_path:string,body:unknown)=>{
    bodies.push(body);
    if(bodies.length===1)throw Object.assign(new Error('Timed out'),{name:'TimeoutError'});
    return {status:'success',data:{html:otPage()}} as T;
  };
  const result=await collectDiningReviews(restaurant,'OpenTable',otUrl,request,event=>events.push(event),new AbortController().signal);
  assert.deepEqual(bodies.map(body=>(body as {driver:string}).driver),['auto','vx10']);
  assert.equal(result.structured!.reviews.length,1);assert.equal(events.at(-1)?.status,'complete');
});

test('collection retries at most once and never retries authentication or quota failures',async()=>{
  for(const status of [401,403,429,503]){
    let calls=0;
    const request:Parameters<typeof collectDiningReviews>[3]=async()=>{calls++;throw Object.assign(new Error('Synthetic error'),{status});};
    await assert.rejects(collectDiningReviews(restaurant,'Tripadvisor',taUrl,request,()=>{},new AbortController().signal),/Synthetic error/);
    assert.equal(calls,status===503?2:1);
  }
});

test('schema accepts all six platform groups and all five star tiers',()=>{
  const summaries=['All','Google','Yelp','Grubhub','Tripadvisor','OpenTable'].flatMap(platform=>[null,1,2,3,4,5].map(stars=>({platform,stars,text:'Synthetic summary',praise:[],concerns:[],evidenceIds:[]})));
  assert.equal(analysisSchema.parse({platforms:[],reviews:[],summaries}).summaries.length,36);
});

test('new provider summaries cite only reviews from the selected provider and star tier',()=>{
  const sources=[tripadvisorSource(restaurant,taUrl,taPage()),openTableSource(restaurant,otUrl,otPage())];
  const summaries=[
    {platform:'Tripadvisor',stars:4,text:'Synthetic Tripadvisor summary',praise:[],concerns:[],evidenceIds:['tripadvisor-789']},
    {platform:'OpenTable',stars:5,text:'Synthetic OpenTable summary',praise:[],concerns:[],evidenceIds:['opentable-OT-1703-123']},
    {platform:'OpenTable',stars:4,text:'Wrong provider evidence',praise:[],concerns:[],evidenceIds:['tripadvisor-789']},
    {platform:'Tripadvisor',stars:1,text:'Wrong tier evidence',praise:[],concerns:[],evidenceIds:['tripadvisor-789']}
  ];
  const result=validateAnalysis({platforms:[],reviews:[],summaries},sources);
  assert.equal(result.reviews.length,2);
  assert.deepEqual(result.summaries.map(item=>item.text),['Synthetic Tripadvisor summary','Synthetic OpenTable summary']);
});
