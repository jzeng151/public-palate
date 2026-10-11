import { load } from 'cheerio/slim';
import { z } from 'zod';
import type { Restaurant } from './restaurant-data.ts';
import type { PipelineEvent, Review, SourcePage } from './review-model.ts';
import { matchesRestaurant } from './restaurant-match.ts';

const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const decode=(value:string)=>load(value,{},false).root().text();
const decodedText=z.string().transform(decode);
const addressSchema=z.object({name:decodedText,'@type':z.literal('Restaurant'),address:z.object({streetAddress:decodedText,postalCode:z.string()})});
const feedSchema=z.object({
  encid:z.string().min(1),alias:z.string(),name:z.string(),rating:z.number().min(0).max(5).nullish(),reviewCount:z.number().int().nonnegative().nullish(),
  reviews:z.object({edges:z.array(z.object({node:z.unknown()}))})
});
const reviewSchema=z.object({
  encid:z.string().min(1),text:z.object({full:z.string()}),rating:z.number().int().min(1).max(5).nullish(),
  author:z.object({displayName:z.string()}).nullish(),createdAt:z.object({localDateTimeForBusiness:z.string()}).nullish(),
  business:z.object({encid:z.string(),alias:z.string()})
});
export type YelpPageData={html?:string;network_capture?:unknown[]};
type Identity={name:string;address:{streetAddress:string;postalCode:string};businessId?:string};
type ExtractResult={status:string;status_code?:number;data?:YelpPageData};
type RequestJson=<T>(path:string,body:unknown,signal:AbortSignal,timeoutMs?:number)=>Promise<T>;
const feedUrl='https://www.yelp.com/gql/batch';

function pageIdentity(restaurant:Restaurant,url:string,html:string):Identity|undefined{
  const $=load(html),alias=new URL(url).pathname.split('/')[2];
  let identity:Identity|undefined;
  $('script[data-apollo-state]').each((_,script)=>{
    try{
      const state=object(JSON.parse(decode($(script).text().replace(/^<!--/,'').replace(/-->$/,''))));
      for(const [key,entry] of Object.entries(state)){
        const business=object(entry),ref=object(business.location).__ref;
        if(business.__typename!=='Business'||business.alias!==alias||typeof business.name!=='string')continue;
        const location=object(typeof ref==='string'?state[ref]:business.location),address=object(location.address);
        const id=typeof business.encid==='string'?business.encid:key.startsWith('Business:')?key.slice(9):'';
        if(id&&typeof address.addressLine1==='string'&&typeof address.postalCode==='string'&&matchesRestaurant(restaurant,business.name,address.addressLine1,address.postalCode))identity={name:business.name,address:{streetAddress:address.addressLine1,postalCode:address.postalCode},businessId:id};
      }
    }catch{/* The script contains entity-escaped JSON, not executable code. */}
  });
  if(identity)return identity;
  $('script[type="application/ld+json"]').each((_,script)=>{
    try{
      const json=JSON.parse($(script).text());
      const candidates=Array.isArray(json)?json:Array.isArray(json?.['@graph'])?json['@graph']:[json];
      for(const candidate of candidates){
        const parsed=addressSchema.safeParse(candidate);
        if(parsed.success&&matchesRestaurant(restaurant,parsed.data.name,parsed.data.address.streetAddress,parsed.data.address.postalCode))identity=parsed.data;
      }
    }catch{/* Ignore malformed page metadata. */}
  });
  return identity;
}

// Public read-only operation observed in Yelp's own review feed on 2026-10-11.
// If Yelp changes the operation ID, browser capture below uses its current request.
function reviewOperation(businessId:string){
  return [{operationName:'GetBusinessReviewFeed',extensions:{operationType:'query',documentId:'ff5cc42130207a545c35885d4243e85fa6aa9160ce01558c4c608e8b1a63f654'},variables:{
    eliteAllStarSourceFlow:'biz_page_review_feed',fetchMediaReviewContent:false,photoSize:'SQUARE_348',encBizId:businessId,reviewsPerPage:10,
    selectedReviewEncId:'',hasSelectedReview:false,sortBy:'RELEVANCE_DESC',ratings:[5,4,3,2,1],queryText:'',isSearching:false,after:null,
    isTranslating:false,translateLanguageCode:'en',reactionsSourceFlow:'businessPageReviewSection',minConfidenceLevel:'HIGH_CONFIDENCE',highlightType:'',highlightIdentifier:'',isHighlighting:false
  }}];
}
function checkResult(result:ExtractResult){
  if(result.status!=='success'||(result.status_code&&result.status_code>=400))throw new Error('Nimble could not load Yelp’s review data. Try refreshing reviews.');
}
export async function collectYelpReviews(restaurant:Restaurant,url:string,request:RequestJson,notify:(event:PipelineEvent)=>void,signal:AbortSignal):Promise<SourcePage>{
  let source:SourcePage;
  try{
    const page=await request<ExtractResult>('/extract',{url,formats:['html'],driver:'vx6',request_timeout:30000},signal,45000);
    checkResult(page);
    const identity=pageIdentity(restaurant,url,page.data?.html||'');
    if(!identity?.businessId)throw new Error('Yelp business identity was not available in the initial page.');
    const feed=await request<ExtractResult>('/extract',{url:feedUrl,method:'POST',headers:{'Content-Type':'application/json'},body:reviewOperation(identity.businessId),is_xhr:true,driver:'vx6',formats:['html'],request_timeout:30000},signal,45000);
    checkResult(feed);
    source=yelpSource(restaurant,url,page.data||{},feed.data?.html);
  }catch(error){
    if(signal.aborted||[401,403,429].includes(Number(object(error).status)))throw error;
    notify({stage:'extract',platform:'Yelp',status:'running',message:'Waiting for Yelp’s written reviews to load'});
    const result=await request<ExtractResult>('/extract',{
      url,formats:['html'],driver:'vx10-pro',request_timeout:60000,
      browser_actions:[{wait_for_element:{selector:'#reviews li [lang]',timeout:30000}}],
      network_capture:[{url:{type:'contains',value:'/gql/batch'}}]
    },signal,180000);
    checkResult(result);
    source=yelpSource(restaurant,url,result.data||{});
  }
  notify({stage:'extract',platform:'Yelp',status:'complete',message:`${source.structured!.reviews.length} Yelp reviews collected`});
  return source;
}

// The review feed arrives after the business HTML. Capture it through Nimble so
// ratings, dates, and review IDs do not depend on Markdown or model extraction.
export function yelpSource(restaurant:Restaurant,url:string,data:YelpPageData,directFeed?:string):SourcePage{
  const feeds:z.infer<typeof feedSchema>[]=[];
  const alias=new URL(url).pathname.split('/')[2];
  const readFeed=(body:string)=>{
    try{
      const entries:unknown=JSON.parse(body);
      if(!Array.isArray(entries))return;
      for(const entry of entries){
        const parsed=feedSchema.safeParse(object(object(entry).data).business);
        if(parsed.success&&parsed.data.alias===alias)feeds.push(parsed.data);
      }
    }catch{/* Ignore unrelated or malformed feed responses. */}
  };
  if(directFeed)readFeed(directFeed);
  for(const capture of data.network_capture||[]){
    const results=object(capture).results;
    if(!Array.isArray(results))continue;
    for(const result of results){
      const item=object(result),request=object(item.request),response=object(item.response);
      if(response.status!==200||typeof request.url!=='string'||typeof response.body!=='string')continue;
      try{
        const endpoint=new URL(request.url);
        if(endpoint.protocol!=='https:'||!['www.yelp.com','yelp.com'].includes(endpoint.hostname)||endpoint.pathname!=='/gql/batch')continue;
        readFeed(response.body);
      }catch{/* Ignore unrelated or malformed network responses. */}
    }
  }
  const missingFeed='Yelp loaded its business page, but the written review feed did not finish loading. Try refreshing reviews.';
  if(!feeds.length)throw new Error(missingFeed);
  const identity=pageIdentity(restaurant,url,data.html||'');
  if(!identity)throw new Error('Yelp did not provide a matching restaurant name, street address, and ZIP. No reviews from an uncertain location were used.');
  const place=identity;
  const feed=feeds.find(feed=>(!place.businessId||place.businessId===feed.encid)&&matchesRestaurant(restaurant,feed.name,place.address.streetAddress,place.address.postalCode)&&feed.reviews.edges.some(edge=>reviewSchema.safeParse(edge.node).success));
  if(!feed)throw new Error('The Yelp review feed did not match this restaurant name and address.');
  const reviews:Review[]=[],seen=new Set<string>();
  for(const edge of feed.reviews.edges){
    const parsed=reviewSchema.safeParse(edge.node);
    if(!parsed.success)continue;
    const row=parsed.data;
    if(row.business.encid!==feed.encid||row.business.alias!==alias)continue;
    const text=row.text.full.trim().slice(0,4000),key=text.toLowerCase().replace(/\s+/g,' ');
    if(!text||seen.has(key)||seen.has(row.encid))continue;
    seen.add(key);seen.add(row.encid);
    reviews.push({id:`yelp-${row.encid}`,platform:'Yelp',text,rating:row.rating??null,author:row.author?.displayName.trim().slice(0,160)||'Anonymous',date:row.createdAt?.localDateTimeForBusiness||null,sourceUrl:url});
    if(reviews.length===30)break;
  }
  if(!reviews.length)throw new Error(missingFeed);
  const platform={platform:'Yelp' as const,match:'confirmed' as const,matchedName:feed.name,matchedAddress:`${place.address.streetAddress}, ${place.address.postalCode}`,sourceUrl:url,rating:feed.rating??null,totalReviews:feed.reviewCount??null,note:`Name, street address, and ZIP matched. Written reviews and ratings collected from Yelp’s review feed using Nimble ${directFeed?'XHR extraction':'browser network capture'}.`};
  const content=[`Yelp: ${platform.matchedName}`,`Address: ${platform.matchedAddress}`,`Source: ${url}`,`Platform rating: ${platform.rating}; total reviews: ${platform.totalReviews}`,...reviews.map(review=>`Review ID: ${review.id}\nAuthor: ${review.author}\nRating: ${review.rating}\nDate: ${review.date}\n${review.text}`)].join('\n\n');
  return {platform:'Yelp',url,title:platform.matchedName,content,status:'collected',structured:{platform,reviews}};
}
