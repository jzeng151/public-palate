import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPlatform, runReviewPipeline } from '../lib/review-pipeline.ts';
import type { Restaurant } from '../lib/restaurant-data.ts';

const restaurant:Restaurant={id:'40732665',name:"Katz's Delicatessen",address:'205 East Houston Street',borough:'Manhattan',zip:'10002',cuisine:'Jewish/Kosher',grade:'A',gradeDate:null,inspectionDate:null,recordDate:null};
const url='https://www.grubhub.com/restaurant/katzs-delicatessen-205-e-houston-st-new-york/83328/reviews';
const listing={url,title:restaurant.name,description:restaurant.address};
const business={name:restaurant.name,'@type':'Restaurant',address:{streetAddress:'205 E Houston St',postalCode:'10002'},aggregateRating:{ratingValue:'4.8',reviewCount:405,ratingCount:'3819'}};
const reviewText='Synthetic review: the sandwich was excellent & delivery was quick.';
const reviewHtml=(identity=business)=>`<script type="application/ld+json">${JSON.stringify(identity)}</script><div data-testid="restaurant-review-item"><div><div><h6 data-testid="review-reviewer-name">Fixture diner</h6></div><span>Oct 10, 2026</span></div><div data-testid="stars-static">${'<svg data-testid="full-star"></svg>'.repeat(4)}</div><span data-testid="review-content">Synthetic review: the sandwich was excellent &amp; delivery was quick.</span></div>`;

test('waits for Grubhub JavaScript instead of collecting its empty loading shell',async t=>{
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request,init?:RequestInit)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[listing]});
    const body=JSON.parse(String(init?.body));
    const rendered=body.driver==='vx10'&&body.render===true&&body.browser_actions?.some((action:{wait?:string})=>action.wait==='10s');
    return Response.json({status:'success',status_code:200,data:rendered?{html:reviewHtml(),markdown:`# ${restaurant.name} Reviews\n${restaurant.address}, New York NY 10002\nFixture diner: ${reviewText}`}:{html:'<title>Prepare your taste buds...</title>',markdown:''}});
  });
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(source.status,'collected');
  assert.match(source.content,/Synthetic review/);
  assert.equal(source.structured?.reviews[0].rating,4);
  assert.equal(source.structured?.reviews[0].text,reviewText);
  assert.equal(source.structured?.platform.totalReviews,405);
});

test('rejects Grubhub reviews for a different branch',async t=>{
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request)=>Response.json(String(input).endsWith('/search')?{results:[listing]}:{status:'success',data:{html:reviewHtml({...business,address:{streetAddress:'1 Other Street',postalCode:'10002'}}),markdown:`${restaurant.name}: ${reviewText}`}}));
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');
  assert.match(source.error||'',/address/);
});

test('keeps Grubhub review text and stars when Gemini fails',async t=>{
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request,init?:RequestInit)=>{
    const requestUrl=String(input),body=JSON.parse(String(init?.body||'{}'));
    if(requestUrl.endsWith('/extract/templates/run'))return Response.json({data:{parsing:{entities:{SearchResult:[]}}}});
    if(requestUrl.endsWith('/search'))return Response.json({results:body.include_domains[0]==='grubhub.com'?[listing]:[]});
    if(requestUrl.endsWith('/extract'))return Response.json({status:'success',data:{html:reviewHtml(),markdown:reviewText}});
    return Response.json({},{status:429});
  });
  const report=await runReviewPipeline(restaurant,'gemini',()=>{},new AbortController().signal);
  assert.equal(report.reviews.length,1);assert.equal(report.reviews[0].text,reviewText);assert.equal(report.reviews[0].rating,4);
  assert.match(report.analysisWarning||'',/quota/);
});

test('rejects a Grubhub country restriction even when Nimble reports HTTP 200 success',async t=>{
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request)=>Response.json(String(input).endsWith('/search')?{results:[listing]}:{status:'success',status_code:200,data:{html:'<title>Grubhub food delivery is not available in your country</title>',markdown:'Grubhub food delivery is not available in your country. We are unable to provide our services in your location. Please visit our help center for more information.'}}));
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');
  assert.match(source.error||'',/country|region/i);
});

test('explains a Yelp extraction timeout with platform context',async t=>{
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[{...listing,url:'https://www.yelp.com/biz/katzs-delicatessen-new-york?start=5180'}]});
    throw new DOMException('The operation was aborted due to timeout','TimeoutError');
  });
  const source=await collectPlatform(restaurant,'Yelp',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');
  assert.match(source.error||'',/Yelp.*timed out/);
});
