import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPlatform, runReviewPipeline } from '../lib/review-pipeline.ts';
import type { Restaurant } from '../lib/restaurant-data.ts';

// Synthetic review fixtures using the real provider response shape and Katz's public identity.
const restaurant:Restaurant={id:'40732665',name:"Katz's Delicatessen",address:'205 East Houston Street',borough:'Manhattan',zip:'10002',cuisine:'Jewish/Kosher',grade:'A',gradeDate:null,inspectionDate:null,recordDate:null};
const place={title:"Katz's Delicatessen",street_address:'205 E Houston St',address:'205 E Houston St, New York, NY 10002',zip_code:'10002',place_id:'test-place',place_url:'https://www.google.com/maps/search/?api=1&query_place_id=test-place',rating:'4.5 stars',number_of_reviews:'100'};
const review={review_id:'test-review',description:'Synthetic fixture: the sandwich was excellent.\nService was quick.',rating:'5',username:'Fixture diner',relative_time:'a week ago'};
const template=(group:string,rows:unknown[])=>({status:'success',status_code:200,data:{parsing:{entities:{[group]:rows}}}});

test('retrieves Google reviews by a matched Place ID rather than generic google.com search',async t=>{
  const calls:Record<string,unknown>[]=[];
  t.mock.method(globalThis,'fetch',async (_url:string|URL|Request,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body||'{}'));calls.push(body);
    if(body.template==='google_maps_search')return Response.json(template('SearchResult',[place]));
    if(body.template==='google_maps_reviews'){
      assert.equal(body.params.place_id,place.place_id);
      return Response.json(template('Review',[review,{...review}, {...review,review_id:'no-text',description:''}]));
    }
    return Response.json({results:[{url:'https://translate.google.com/translate?u=https://example.com/article',title:place.title,description:place.address}]});
  });
  const result=await collectPlatform(restaurant,'Google',()=>{},new AbortController().signal);
  assert.equal(result.status,'collected');
  assert.equal(result.structured?.reviews.length,1);
  assert.equal(result.structured?.reviews[0].rating,5);
  assert.equal(result.structured?.platform.match,'confirmed');
  assert.equal(calls.length,2);
});

test('does not collect reviews from another branch with the same business name',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async ()=>{calls++;return Response.json(template('SearchResult',[{...place,street_address:'1 Other Street',address:'1 Other Street, New York, NY 10002'}]));});
  const source=await collectPlatform(restaurant,'Google',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');assert.match(source.error||'',/address/i);assert.equal(calls,1);
});

test('retrieves Famous Joe’s Pizza reviews when Google omits the promotional prefix',async t=>{
  const joes:Restaurant={...restaurant,id:'40575863',name:"Famous Joe'S Pizza",address:'7 Carmine Street',zip:'10014'};
  // Identity fields from the captured failing Google search; reviews are synthetic.
  const listing={...place,title:"Joe's Pizza",street_address:'7 Carmine St',address:'7 Carmine St, New York, NY 10014',zip_code:'10014',place_id:'joes-carmine'};
  t.mock.method(globalThis,'fetch',async (_url:unknown,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body));
    if(body.template==='google_maps_search')return Response.json(template('SearchResult',[
      {...listing,place_id:'joes-other-branch',street_address:'1435 Broadway',address:'1435 Broadway, New York, NY 10018',zip_code:'10018'},
      {...listing,place_id:'different-business',title:"Mario's Pizza"},
      listing,
    ]));
    assert.equal(body.params.place_id,'joes-carmine');
    return Response.json(template('Review',[review]));
  });
  const result=await collectPlatform(joes,'Google',()=>{},new AbortController().signal);
  assert.equal(result.status,'collected');
  assert.equal(result.structured?.reviews.length,1);
  assert.equal(result.structured?.platform.matchedName,"Joe's Pizza");
});

test('retains structured Google reviews when the summary provider is unavailable',async t=>{
  t.mock.method(globalThis,'fetch',async (_url:string|URL|Request,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body||'{}'));
    if(body.template==='google_maps_search')return Response.json(template('SearchResult',[place]));
    if(body.template==='google_maps_reviews')return Response.json(template('Review',[review]));
    if(body.query)return Response.json({results:[]});
    return Response.json({error:'Synthetic quota error'},{status:429});
  });
  const result=await runReviewPipeline(restaurant,'gemini',()=>{},new AbortController().signal);
  assert.equal(result.reviews.length,1);assert.equal(result.reviews[0].text,review.description);
  assert.equal(result.summaries.length,0);assert.match(result.analysisWarning||'',/quota/);
  assert.ok(result.sources.every(source=>!('structured' in source)&&!('content' in source)));
});
