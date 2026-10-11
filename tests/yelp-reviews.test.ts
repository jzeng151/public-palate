import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPlatform, runReviewPipeline } from '../lib/review-pipeline.ts';
import type { Restaurant } from '../lib/restaurant-data.ts';

const restaurant:Restaurant={id:'40732665',name:"Katz's Delicatessen",address:'205 East Houston Street',borough:'Manhattan',zip:'10002',cuisine:'Jewish/Kosher',grade:'A',gradeDate:null,inspectionDate:null,recordDate:null};
const url='https://www.yelp.com/biz/katzs-delicatessen-new-york';
const identity={name:'Katz&apos;s Delicatessen','@type':'Restaurant',address:{streetAddress:'205 E Houston St',postalCode:'10002'}};
const review={encid:'fixture-review',text:{full:'Synthetic Yelp review: a generous sandwich.\nService was slow.'},rating:4,author:{displayName:'Fixture diner'},createdAt:{localDateTimeForBusiness:'2026-10-09T13:03:17-04:00'},business:{encid:'fixture-business',alias:'katzs-delicatessen-new-york'},bizUserPublicReply:{text:'Synthetic owner reply. Do not count as a review.'}};
const business={encid:'fixture-business',alias:'katzs-delicatessen-new-york',name:restaurant.name,rating:4.1,reviewCount:100,reviews:{edges:[{node:review},{node:review}]}};
const captured=(feed=business,place=identity)=>({status:'success',status_code:200,data:{
  html:`<script type="application/ld+json">${JSON.stringify(place)}</script><div id="reviews"><li><p><span lang="en">${review.text.full}</span></p></li></div>`,
  markdown:'The written reviews were omitted during Markdown conversion.',
  network_capture:[{filter:{url:{type:'contains',value:'/gql/batch'}},results:[{request:{url:'https://www.yelp.com/gql/batch'},response:{status:200,serialization:'none',body:JSON.stringify([{data:{business:{...feed,reviews:{edges:[{node:{encid:'preview-only'}}]}}}},{data:{business:feed}}])}}]}]
}});
const nativeHtml=()=>{
  const state={
    'Business:fixture-business':{__typename:'Business',encid:'fixture-business',alias:business.alias,name:restaurant.name,location:{__ref:'BusinessLocation:fixture-business'}},
    'BusinessLocation:fixture-business':{address:{addressLine1:'205 E Houston St',postalCode:'10002'}}
  };
  return `<script data-apollo-state type="application/json"><!--${JSON.stringify(state).replaceAll('&','&amp;').replaceAll('"','&quot;')}--></script>`;
};

test('uses Nimble XHR with the matched business ID without copying visitor credentials',async t=>{
  const requests:Record<string,unknown>[]=[];
  t.mock.method(globalThis,'fetch',async(input:string|URL|Request,init?:RequestInit)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[{url,title:restaurant.name,description:restaurant.address}]});
    const body=JSON.parse(String(init?.body||'{}'));requests.push(body);
    if(body.url===url&&body.driver==='vx6')return Response.json({status:'success',data:{html:nativeHtml()}});
    if(body.url==='https://www.yelp.com/gql/batch'&&body.is_xhr){
      assert.equal(body.body[0].variables.encBizId,'fixture-business');
      assert.equal(body.body[0].variables.guv,undefined);
      assert.equal(body.headers.Cookie,undefined);
      return Response.json({status:'success',data:{html:JSON.stringify([{data:{business}}])}});
    }
    return Response.json({status:'error'});
  });
  const source=await collectPlatform(restaurant,'Yelp',()=>{},new AbortController().signal);
  assert.equal(source.structured?.reviews.length,1);assert.equal(requests.length,2);
  assert.ok(requests.every(request=>!request.browser_actions));
});

test('captures the Yelp review feed, keeps original ratings, and ignores duplicates and owner replies',async t=>{
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request,init?:RequestInit)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[{url,title:restaurant.name,description:restaurant.address}]});
    const body=JSON.parse(String(init?.body||'{}'));
    if(!body.network_capture?.some((capture:{url?:{value?:string}})=>capture.url?.value==='/gql/batch'))return Response.json({status:'success',data:{markdown:'The Yelp review feed was not captured.'}});
    return Response.json(captured());
  });
  const source=await collectPlatform(restaurant,'Yelp',()=>{},new AbortController().signal);
  assert.equal(source.status,'collected');
  assert.equal(source.structured?.reviews.length,1);
  assert.equal(source.structured?.reviews[0].text,review.text.full);
  assert.equal(source.structured?.reviews[0].rating,4);
  assert.equal(source.structured?.reviews[0].id,'yelp-fixture-review');
  assert.equal(source.structured?.reviews[0].date,review.createdAt.localDateTimeForBusiness);
  assert.equal(source.structured?.platform.totalReviews,100);
  assert.ok(!source.content.includes('owner reply'));
});

test('rejects a Yelp feed when the page address belongs to a different branch',async t=>{
  t.mock.method(globalThis,'fetch',async(input:string|URL|Request)=>Response.json(String(input).endsWith('/search')?{results:[{url,title:restaurant.name,description:restaurant.address}]}:captured(business,{...identity,address:{streetAddress:'1 Other Street',postalCode:'10002'}})));
  const source=await collectPlatform(restaurant,'Yelp',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');assert.match(source.error||'',/address/i);
});

test('rejects review records whose business ID differs from the matched Yelp feed',async t=>{
  t.mock.method(globalThis,'fetch',async(input:string|URL|Request)=>Response.json(String(input).endsWith('/search')?{results:[{url,title:restaurant.name,description:restaurant.address}]}:captured({...business,reviews:{edges:[{node:{...review,business:{...review.business,encid:'unrelated-business'}}}]}})));
  const source=await collectPlatform(restaurant,'Yelp',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');assert.match(source.error||'',/review.*load|review feed/i);
});

test('retains captured Yelp reviews if Gemini fails',async t=>{
  t.mock.method(globalThis,'fetch',async(input:string|URL|Request,init?:RequestInit)=>{
    const requestUrl=String(input),body=JSON.parse(String(init?.body||'{}'));
    if(requestUrl.endsWith('/extract/templates/run'))return Response.json({data:{parsing:{entities:{SearchResult:[]}}}});
    if(requestUrl.endsWith('/search'))return Response.json({results:body.include_domains[0]==='yelp.com'?[{url,title:restaurant.name,description:restaurant.address}]:[]});
    if(requestUrl.endsWith('/extract'))return Response.json(captured());
    return Response.json({},{status:429});
  });
  const result=await runReviewPipeline(restaurant,'gemini',()=>{},new AbortController().signal);
  assert.equal(result.reviews.length,1);assert.equal(result.reviews[0].rating,4);assert.equal(result.summaries.length,0);assert.match(result.analysisWarning||'',/quota/);
});

// Reduced from a real HTTP 200 response: business details loaded, review feed did not.
test('does not count a Yelp business page with a loading review feed as collected reviews',async t=>{
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request)=>Response.json(String(input).endsWith('/search')?{results:[{url,title:restaurant.name,description:restaurant.address}]}:{status:'success',status_code:200,data:{
    html:`<title>${restaurant.name} - Yelp</title><h1>${restaurant.name}</h1><address>205 E Houston St, New York, NY 10002</address><div id="reviews"><h2>Recommended Reviews</h2><span>Loading...</span><span>Loading...</span></div>`,
    markdown:`# ${restaurant.name}\n4.1 (17.1k reviews)\n205 E Houston St, New York, NY 10002\nHours and menu. Find directions and browse nearby businesses.\nRecommended Reviews`
  }}));
  const source=await collectPlatform(restaurant,'Yelp',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');
  assert.match(source.error||'',/review.*load/i);
});
