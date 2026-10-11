import test from 'node:test';
import assert from 'node:assert/strict';
import { runReviewPipeline } from '../lib/review-pipeline.ts';
import type { Restaurant } from '../lib/restaurant-data.ts';
import type { PipelineEvent } from '../lib/review-model.ts';

// Synthetic fixtures for network isolation. These never enter the app catalog.
const restaurant:Restaurant={id:'test',name:'Test Noodles',address:'1 Test Street',borough:'Queens',zip:'11101',cuisine:'Asian/Asian Fusion',grade:'A',gradeDate:'2026-01-01',inspectionDate:'2026-01-01',recordDate:'2026-01-02'};
const listing='https://www.yelp.com/biz/test-noodles';
const excerpt='The noodles were excellent and the staff were kind.';
const analysis={platforms:[{platform:'Yelp',match:'confirmed',matchedName:restaurant.name,matchedAddress:restaurant.address,sourceUrl:listing,rating:4.2,totalReviews:70,note:'Matched name and address.'}],reviews:[{id:'yelp-r1',platform:'Yelp',rating:5,text:excerpt,author:'Test diner',date:null,sourceUrl:listing},{id:'r2',platform:'Yelp',rating:1,text:'This review does not exist in the page.',author:'Invented',date:null,sourceUrl:listing}],summaries:[{platform:'Yelp',stars:5,text:'Diners praise noodles and staff in the collected sample.',praise:['Noodles'],concerns:[],evidenceIds:['yelp-r1']},{platform:'All',stars:null,text:'Unsupported text.',praise:[],concerns:[],evidenceIds:['r2']}]};
const yelpPage={status:'success',data:{
  html:`<script type="application/ld+json">${JSON.stringify({'@type':'Restaurant',name:restaurant.name,address:{streetAddress:restaurant.address,postalCode:restaurant.zip}})}</script>`,
  network_capture:[{results:[{request:{url:'https://www.yelp.com/gql/batch'},response:{status:200,body:JSON.stringify([{data:{business:{encid:'test-business',alias:'test-noodles',name:restaurant.name,rating:4.2,reviewCount:70,reviews:{edges:[{node:{encid:'r1',text:{full:excerpt},rating:5,author:{displayName:'Test diner'},business:{encid:'test-business',alias:'test-noodles'}}}]}}}}])}}]}]
}};

test('collects available evidence, tolerates platform failures, retries a Gemini outage, and validates output',async t=>{
  const events:PipelineEvent[]=[];const requests:{url:string;body:Record<string,unknown>}[]=[];
  let modelCalls=0;
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request,init?:RequestInit)=>{
    const url=String(input),body=JSON.parse(String(init?.body||'{}'));requests.push({url,body});
    if(url.endsWith('/extract/templates/run'))return Response.json({status:'success',data:{parsing:{entities:{SearchResult:[]}}}});
    if(url.endsWith('/search'))return Response.json({results:body.include_domains[0]==='yelp.com'?[{url:listing,title:restaurant.name,description:restaurant.address}]:[]});
    if(url.endsWith('/extract'))return Response.json(yelpPage);
    if(url.includes(':generateContent'))return ++modelCalls===1?Response.json({error:'Synthetic provider outage'},{status:503}):Response.json({candidates:[{content:{parts:[{text:JSON.stringify(analysis)}]}}]});
    throw new Error('Unexpected network request');
  });
  const result=await runReviewPipeline(restaurant,'gemini',e=>events.push(e),new AbortController().signal);
  assert.equal(requests.filter(r=>r.url.endsWith('/search')).length,2);
  assert.equal(result.sources.filter(s=>s.status==='collected').length,1);
  assert.equal(result.reviews.length,1);
  assert.equal(result.summaries.length,1);
  assert.equal(result.platforms.length,3);
  assert.equal(result.sources.some(s=>'content' in s),false);
  assert.equal(result.engine,'gemini');
  assert.equal(modelCalls,2);
  assert.ok(events.some(e=>e.stage==='summarize'&&e.status==='complete'));
  const prompt=JSON.stringify(requests.find(r=>r.url.includes(':generateContent'))?.body);
  assert.ok(prompt.includes(restaurant.address)&&prompt.includes(excerpt));
});

test('does not ask a model to summarize when every platform is unavailable',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request)=>{
    calls++;assert.ok(String(input).endsWith('/search')||String(input).endsWith('/extract/templates/run'));
    return Response.json({error:'Test quota error'},{status:429});
  });
  const result=await runReviewPipeline(restaurant,'nimble',()=>{},new AbortController().signal);
  assert.equal(calls,3);assert.equal(result.reviews.length,0);assert.equal(result.summaries.length,0);
  assert.ok(result.sources.every(s=>s.status==='unavailable'));
  assert.ok(result.platforms.every(p=>p.note.includes('request limit')));
});

test('retrieves structured Nimble agent results using its returned run identity',async t=>{
  const urls:string[]=[];
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request,init?:RequestInit)=>{
    const url=String(input),body=JSON.parse(String(init?.body||'{}'));urls.push(url);
    if(url.endsWith('/extract/templates/run'))return Response.json({status:'success',data:{parsing:{entities:{SearchResult:[]}}}});
    if(url.endsWith('/search'))return Response.json({results:body.include_domains[0]==='yelp.com'?[{url:listing,title:restaurant.name,description:restaurant.address}]:[]});
    if(url.endsWith('/extract'))return Response.json(yelpPage);
    if(url.endsWith('/agents/runs'))return Response.json({id:'test-run',web_search_agent_id:'test-agent'});
    if(url.endsWith('/agents/test-agent/runs/test-run'))return Response.json({status:'completed',is_active:false});
    if(url.endsWith('/agents/test-agent/runs/test-run/result'))return Response.json({output:{content:analysis}});
    throw new Error('Unexpected network request');
  });
  const result=await runReviewPipeline(restaurant,'nimble',()=>{},new AbortController().signal);
  assert.equal(result.engine,'nimble');assert.equal(result.reviews.length,1);
  assert.ok(urls.some(url=>url.endsWith('/test-run/result')));
});
