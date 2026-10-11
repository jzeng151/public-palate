import type { Restaurant } from './restaurant-data.ts';
import { isPlatformUrl, type PipelineEvent, type Review, type SourcePage } from './review-model.ts';
import { matchesRestaurant, normalizeName as normalize } from './restaurant-match.ts';

type RequestJson=<T>(path:string,body:unknown,signal:AbortSignal)=>Promise<T>;
type Entity=Record<string,unknown>;
type TemplateResult={status?:string;status_code?:number;data?:{parsing?:{status?:string;entities?:Record<string,Entity[]>}}};
const value=(input:unknown)=>typeof input==='string'?input:typeof input==='number'?String(input):'';
function matchesPlace(restaurant:Restaurant,place:Entity){
  const zip=value(place.zip_code)||(new RegExp(`\\b${restaurant.zip}\\b`).test(value(place.address))?restaurant.zip:'');
  return matchesRestaurant(restaurant,value(place.title),value(place.street_address)||value(place.address),zip)&&Boolean(value(place.place_id));
}
function entities(result:TemplateResult,group:string){
  if(result.status==='error'||result.status==='failed'||(result.status_code&&result.status_code>=400)||result.data?.parsing?.status==='error')throw new Error('Nimble could not parse the Google Maps response. Please try again.');
  const rows=result.data?.parsing?.entities?.[group];
  return Array.isArray(rows)?rows.filter(row=>row&&typeof row==='object'):[];
}

export async function collectGoogleReviews(restaurant:Restaurant,request:RequestJson,notify:(event:PipelineEvent)=>void,signal:AbortSignal):Promise<SourcePage>{
  notify({stage:'search',platform:'Google',status:'running',message:'Finding the exact restaurant on Google Maps'});
  const search=await request<TemplateResult>('/extract/templates/run',{template:'google_maps_search',params:{query:`${restaurant.name} ${restaurant.address} ${restaurant.borough} New York NY ${restaurant.zip}`}},signal);
  const place=entities(search,'SearchResult').find(place=>matchesPlace(restaurant,place));
  if(!place)throw new Error('Google Maps did not return a listing matching this restaurant name and street address.');
  const placeId=value(place.place_id);
  const url=isPlatformUrl(value(place.place_url),'Google')?value(place.place_url):`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}&query_place_id=${encodeURIComponent(placeId)}`;
  notify({stage:'search',platform:'Google',status:'complete',message:'Google Maps name and address matched'});
  notify({stage:'extract',platform:'Google',status:'running',message:'Collecting Google reviews by Place ID'});
  const result=await request<TemplateResult>('/extract/templates/run',{template:'google_maps_reviews',params:{place_id:placeId,num_results:20,sort:'relevant'}},signal);
  const seen=new Set<string>();
  const reviews:Review[]=[];
  for(const row of entities(result,'Review')){
    const text=value(row.description).trim().slice(0,4000),key=normalize(text),rawId=value(row.review_id);
    if(!text||seen.has(key)||(rawId&&seen.has(rawId)))continue;
    seen.add(key);if(rawId)seen.add(rawId);
    const rating=Number(value(row.rating));
    reviews.push({id:`google-${rawId||reviews.length+1}`,platform:'Google',rating:Number.isInteger(rating)&&rating>=1&&rating<=5?rating:null,text,author:value(row.username).slice(0,160)||'Anonymous',date:value(row.relative_time)||null,sourceUrl:url});
    if(reviews.length===20)break;
  }
  if(!reviews.length)throw new Error('The Google Maps listing matched, but the review collector returned no written reviews. Try again later.');
  const rawRating=parseFloat(value(place.rating)),rawCount=Number(value(place.number_of_reviews).replaceAll(',',''));
  const platform={platform:'Google' as const,match:'confirmed' as const,matchedName:value(place.title),matchedAddress:value(place.address)||value(place.street_address),sourceUrl:url,rating:Number.isFinite(rawRating)&&rawRating>=0&&rawRating<=5?rawRating:null,totalReviews:value(place.number_of_reviews)&&Number.isInteger(rawCount)&&rawCount>=0?rawCount:null,note:'Name, street address, and ZIP matched. Reviews collected with Nimble’s Google Maps template, sorted by relevance.'};
  const content=[`Google Maps: ${platform.matchedName}`,`Address: ${platform.matchedAddress}`,`Source: ${url}`,`Platform rating: ${platform.rating}; total reviews: ${platform.totalReviews}`,...reviews.map(review=>`Review ID: ${review.id}\nAuthor: ${review.author}\nRating: ${review.rating}\nDate: ${review.date}\n${review.text}`)].join('\n\n');
  notify({stage:'extract',platform:'Google',status:'complete',message:`${reviews.length} Google reviews collected`});
  return {platform:'Google',url,title:platform.matchedName,content,status:'collected',structured:{platform,reviews}};
}
