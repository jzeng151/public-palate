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
    const rendered=body.driver==='vx10'&&body.render===true&&body.browser_actions?.some((action:{wait_for_element?:{selector?:string}})=>action.wait_for_element?.selector?.includes('review-content'));
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
  let requests=0;
  t.mock.method(globalThis,'fetch',async (input:string|URL|Request)=>{requests++;return Response.json(String(input).endsWith('/search')?{results:[listing]}:{status:'success',data:{html:reviewHtml({...business,address:{streetAddress:'1 Other Street',postalCode:'10002'}}),markdown:`${restaurant.name}: ${reviewText}`}});});
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');
  assert.match(source.error||'',/address/);
  assert.equal(requests,2,'wrong branches must not trigger another extraction');
});

test('uses the canonical review URL when search returns a catering page',async t=>{
  t.mock.method(globalThis,'fetch',async (input:unknown,init?:RequestInit)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[{...listing,url:url.replace('/reviews','/catering?utm_source=test')}]});
    const body=JSON.parse(String(init?.body));
    return Response.json({status:'success',data:{html:body.url===url?reviewHtml():`<script type="application/ld+json">${JSON.stringify(business)}</script>`}});
  });
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(source.url,url);assert.equal(source.status,'collected');assert.equal(source.structured?.reviews.length,1);
});

test('retries a matched Grubhub page whose written reviews have not loaded',async t=>{
  let extracts=0;
  t.mock.method(globalThis,'fetch',async (input:unknown,init?:RequestInit)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[listing]});
    extracts++;
    const body=JSON.parse(String(init?.body));
    if(extracts===2){
      assert.equal(body.driver,'vx10-pro');
      assert.ok(body.browser_actions.some((action:{wait_for_element?:{selector?:string}})=>action.wait_for_element?.selector?.includes('review-content')));
    }
    return Response.json({status:'success',data:{html:extracts===1?`<script type="application/ld+json">${JSON.stringify(business)}</script><p>Reviews loading</p>`:reviewHtml()}});
  });
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(extracts,2);assert.equal(source.status,'collected');assert.equal(source.structured?.reviews.length,1);
});

test('stops after one retry when Grubhub keeps returning a matched page without reviews',async t=>{
  let extracts=0;
  t.mock.method(globalThis,'fetch',async (input:unknown)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[listing]});
    extracts++;
    return Response.json({status:'success',data:{html:`<script type="application/ld+json">${JSON.stringify(business)}</script>`}});
  });
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(extracts,2);assert.equal(source.status,'unavailable');assert.match(source.error!,/written reviews did not finish loading/);
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

test('does not extract a Grubhub candidate for a similarly named restaurant at another address',async t=>{
  let extracts=0;
  t.mock.method(globalThis,'fetch',async (input:unknown)=>{
    if(String(input).endsWith('/extract')){extracts++;return Response.json({status:'success',data:{html:reviewHtml()}});}
    return Response.json({results:[{url:'https://www.grubhub.com/restaurant/monkey-thai-diner-291-central-avenue-clark/11628328',title:'Monkey Thai Diner - Clark, NJ',description:'291 Central Avenue'}]});
  });
  const source=await collectPlatform({...restaurant,name:'Thai Diner',address:'186 Mott Street',zip:'10012'},'Grubhub',()=>{},new AbortController().signal);
  assert.equal(extracts,0,'irrelevant results must be rejected before extraction');
  assert.match(source.error!,/No matching Grubhub listing/);
});

test('retries a Grubhub country restriction once through a US New York request',async t=>{
  let extracts=0;
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[listing]});
    extracts++;const body=JSON.parse(String(init?.body));
    if(extracts===2){assert.equal(body.country,'US');assert.equal(body.state,'NY');}
    return Response.json({status:'success',status_code:200,data:{html:extracts===1?'<title>Grubhub food delivery is not available in your country</title>':reviewHtml()}});
  });
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(source.status,'collected');assert.equal(extracts,2);
});

test('reports a retired Grubhub listing without retrying or borrowing nearby restaurant reviews',async t=>{
  let extracts=0;
  t.mock.method(globalThis,'fetch',async (input:unknown)=>{
    if(String(input).endsWith('/search'))return Response.json({results:[listing]});
    extracts++;
    return Response.json({status:'success',data:{html:'<h1>Katz’s Delicatessen</h1><button data-testid="restaurant-address-button">205 E Houston St</button><h3>Not available on Grubhub anymore</h3><h2>Similar options nearby</h2>'+reviewHtml({...business,name:'Other Deli'})}});
  });
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(source.status,'unavailable');assert.equal(extracts,1);
  assert.match(source.error!,/no longer available on Grubhub/);
});

test('uses lite URL discovery when standard Grubhub search misses the precise restaurant',async t=>{
  let searches=0;
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body));
    if(String(input).endsWith('/search')){
      searches++;
      if(body.search_depth==='lite')return Response.json({results:[{url:'https://www.grubhub.com/restaurant/katzs-delicatessen-1-other-st-brooklyn/222',title:restaurant.name,description:'1 Other Street'},listing]});
      return Response.json({results:[]});
    }
    assert.equal(body.url,url);
    return Response.json({status:'success',data:{html:reviewHtml()}});
  });
  const source=await collectPlatform(restaurant,'Grubhub',()=>{},new AbortController().signal);
  assert.equal(searches,2);assert.equal(source.status,'collected');assert.equal(source.url,url);
});
