import { load } from 'cheerio/slim';
import type { Restaurant } from './restaurant-data.ts';
import { isPlatformUrl, type Analysis, type PipelineEvent, type Review, type SourcePage } from './review-model.ts';
import { matchesRestaurant } from './restaurant-match.ts';

type DiningPlatform='Tripadvisor'|'OpenTable';
type RecordData=Record<string,unknown>;
type RequestJson=<T>(path:string,body:unknown,signal:AbortSignal,timeoutMs?:number)=>Promise<T>;
const object=(value:unknown):RecordData=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as RecordData:{};
const string=(value:unknown)=>typeof value==='string'?value:typeof value==='number'?String(value):'';
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
function number(value:unknown,min:number,max:number,integer=false){
  if(value===null||value===undefined||value==='')return null;
  const parsed=typeof value==='number'||typeof value==='string'?Number(value):NaN;
  return Number.isFinite(parsed)&&parsed>=min&&parsed<=max&&(!integer||Number.isInteger(parsed))?parsed:null;
}
const zip=(value:unknown)=>string(value).match(/^\d{5}(?:-\d{4})?$/)?.[0].slice(0,5)||'';
class ReviewsPending extends Error {}
export class DiningLocationMismatch extends Error {}

function source(platform:Analysis['platforms'][number],reviews:Review[]):SourcePage{
  if(!reviews.length)throw new ReviewsPending(`The ${platform.platform} listing matched, but no written reviews were available in the captured page. Check the listing directly or retry later.`);
  const content=[`${platform.platform}: ${platform.matchedName}`,`Address: ${platform.matchedAddress}`,`Source: ${platform.sourceUrl}`,`Platform rating: ${platform.rating}; rating basis: ${platform.ratingBasis||'provider-defined'}; total reviews: ${platform.totalReviews}`,platform.note,...reviews.map(review=>`Review ID: ${review.id}\nAuthor: ${review.author}\nRating: ${review.rating}\nDate: ${review.date}\n${review.text}`)].join('\n\n');
  return {platform:platform.platform,url:platform.sourceUrl,title:platform.matchedName,content,status:'collected',structured:{platform,reviews}};
}

export async function collectDiningReviews(restaurant:Restaurant,platform:DiningPlatform,url:string,request:RequestJson,notify:(event:PipelineEvent)=>void,signal:AbortSignal):Promise<SourcePage>{
  if(!isPlatformUrl(url,platform))throw new Error(`Invalid ${platform} restaurant URL.`);
  for(let attempt=0;attempt<2;attempt++){
    try{
      const result=await request<{status:string;status_code?:number;data?:{html?:string}}>('/extract',{
        url,formats:['html'],driver:platform==='OpenTable'&&attempt===0?'auto':'vx10',country:'US',request_timeout:60000
      },signal,90000);
      if(result.status!=='success'||(result.status_code&&result.status_code>=400))throw Object.assign(new Error(`${platform} did not return readable review content.`),{status:result.status_code});
      const captured=(platform==='Tripadvisor'?tripadvisorSource:openTableSource)(restaurant,url,result.data?.html||'');
      notify({stage:'extract',platform,status:'complete',message:`${captured.structured!.reviews.length} ${platform} reviews collected`});
      return captured;
    }catch(error){
      const status=Number(object(error).status);
      if(signal.aborted||attempt===1||!(error instanceof ReviewsPending||(error instanceof Error&&error.name==='TimeoutError')||status>=500))throw error;
      notify({stage:'extract',platform,status:'running',message:`Retrying ${platform} review collection`});
    }
  }
  throw new Error(`${platform} review collection did not complete.`);
}

// Parse data only. Page scripts and their instructions are never executed.
export function openTableSource(restaurant:Restaurant,url:string,html:string):SourcePage{
  if(!isPlatformUrl(url,'OpenTable'))throw new Error('Invalid OpenTable restaurant URL.');
  const $=load(html);
  let state:RecordData;
  try{state=object(JSON.parse($('#primary-window-vars').text()));}
  catch{throw new ReviewsPending('OpenTable did not finish loading its restaurant and review records. Try refreshing reviews.');}
  const profile=object(object(object(state.windowVariables).__INITIAL_STATE__).restaurantProfile);
  const business=object(profile.restaurant),address=object(business.address);
  const id=string(business.restaurantId),name=string(business.name),street=string(address.line1),postal=zip(address.postCode);
  const requestedId=new URL(url).pathname.match(/^\/restaurant\/profile\/(\d+)/)?.[1];
  if(!id||!name.trim()||!street.trim()||!string(address.postCode).trim())throw new ReviewsPending('OpenTable did not finish loading its restaurant and review records. Try refreshing reviews.');
  if(!/^\d+$/.test(id)||(requestedId&&requestedId!==id)||!matchesRestaurant(restaurant,name,street,postal))throw new DiningLocationMismatch('OpenTable did not provide a matching restaurant name, street address, and ZIP. No reviews from an uncertain location were used.');
  const statistics=object(object(business.statistics).reviews),ratings=object(statistics.ratings);
  const reviews:Review[]=[],seen=new Set<string>();
  for(const entry of array(object(object(profile.reviewsData).reviewSearchResults).reviews)){
    const review=object(entry),rawId=string(review.reviewId),text=string(review.text).trim().slice(0,4000);
    // Both reservation reviews (OT) and older open reviews (OR) carry the restaurant ID.
    if(!new RegExp(`^(?:OT|OR)-${id}-`).test(rawId)||!text||review.fromPreviousConcept===true||seen.has(rawId)||reviews.length>=30)continue;
    seen.add(rawId);
    reviews.push({id:`opentable-${rawId}`,platform:'OpenTable',text,rating:number(object(review.rating).overall,1,5,true),author:string(object(review.user).nickname).slice(0,160)||'Anonymous',date:string(review.submittedDateTime)||string(review.dinedDateTime)||null,sourceUrl:url});
  }
  const ratingBasis=statistics.ratingBasedOn==='RecentReviews'?'recent':statistics.ratingBasedOn==='AllTime'?'all_time':undefined;
  return source({platform:'OpenTable',match:'confirmed',matchedName:name,matchedAddress:`${street}, ${postal}`,sourceUrl:url,rating:number(object(ratings.overall).rating,1,5),totalReviews:number(statistics.allTimeTextReviewCount,0,Number.MAX_SAFE_INTEGER,true),ratingBasis,note:`Name, street address, and ZIP matched. Written reviews and explicit overall stars read from OpenTable records captured by Nimble. ${ratingBasis==='recent'?'The average covers recent ratings; the written review count is all-time.':ratingBasis==='all_time'?'The average and written review count are all-time.':'The written review count is all-time; the average follows OpenTable’s own rating window.'} Review dates may be old, and reviews are not all verified reservations.`},reviews);
}

function jsonLdNodes(value:unknown):RecordData[]{
  if(Array.isArray(value))return value.flatMap(jsonLdNodes);
  const node=object(value);
  return [node,...array(node['@graph']).flatMap(jsonLdNodes)];
}

export function tripadvisorSource(restaurant:Restaurant,url:string,html:string):SourcePage{
  if(!isPlatformUrl(url,'Tripadvisor'))throw new Error('Invalid Tripadvisor restaurant URL.');
  const $=load(html),locationId=new URL(url).pathname.match(/-d(\d+)-/)![1];
  let cleanAddress:RecordData|undefined;
  // Tripadvisor sometimes appends cross streets to JSON-LD streetAddress.
  // Use the separate street1 field only from the exact requested location ID.
  $('script[src^="data:text/javascript,"]').each((_,script)=>{
    try{
      const code=decodeURIComponent($(script).attr('src')!.split(',').slice(1).join(','));
      const literal=code.match(/JSON\.parse\(("(?:\\.|[^"\\])*")\)/)?.[1];
      if(!literal)return;
      const bootstrap=object(JSON.parse(JSON.parse(literal)));
      for(const entry of Object.values(object(object(bootstrap.urqlSsrData).results))){
        const data=object(JSON.parse(string(object(entry).data)));
        for(const candidate of array(data.locations)){
          const location=object(candidate);
          if(string(location.locationId)===locationId)cleanAddress=object(location.localizedStreetAddress);
        }
      }
    }catch{/* Ignore malformed data, never execute the bootstrap script. */}
  });
  let business:RecordData|undefined;
  $('script[type="application/ld+json"]').each((_,script)=>{
    try{
      for(const node of jsonLdNodes(JSON.parse($(script).text()))){
        const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];
        const identity=string(node['@id'])||string(node.url);
        if(types.some(type=>type==='Restaurant'||type==='FoodEstablishment')&&identity.includes(`-d${locationId}-`))business||=node;
      }
    }catch{/* Ignore malformed structured data. */}
  });
  if(!business)throw new ReviewsPending('Tripadvisor did not finish loading its restaurant records. Try refreshing reviews.');
  const address=object(business.address),name=string(business.name);
  const street=string(cleanAddress?.street1)||string(address.streetAddress),postal=zip(cleanAddress?.postalCode)||zip(address.postalCode);
  if(!matchesRestaurant(restaurant,name,street,postal))throw new DiningLocationMismatch('Tripadvisor did not provide a matching restaurant name, street address, and ZIP. No reviews from an uncertain location were used.');
  const reviews:Review[]=[],seen=new Set<string>();
  $('[data-automation="reviewCard"]').each((_,element)=>{
    const card=$(element),body=card.find('[data-test-target="review-body"]').clone();
    body.find('button').remove();
    const text=body.text().trim().slice(0,4000),href=card.find('[data-test-target="review-title"] a').attr('href')||'';
    const rawId=href.match(new RegExp(`-d${locationId}-r(\\d+)-`))?.[1];
    if(!rawId||!text||seen.has(rawId)||reviews.length>=30)return;
    seen.add(rawId);
    const rating=card.find('[data-automation="bubbleRatingImage"] title').first().text().match(/^([1-5]) of 5 bubbles$/)?.[1];
    const date=card.find('div').filter((_,node)=>!$(node).children().length&&/^Written /.test($(node).text())).first().text().replace(/^Written /,'').trim();
    reviews.push({id:`tripadvisor-${rawId}`,platform:'Tripadvisor',text,rating:number(rating,1,5,true),author:card.find('a[href^="/Profile/"], a[href^="/ClientLink?"]').filter((_,node)=>Boolean($(node).text().trim())).first().text().trim().slice(0,160)||'Anonymous',date:date||null,sourceUrl:url});
  });
  const aggregate=object(business.aggregateRating);
  return source({platform:'Tripadvisor',match:'confirmed',matchedName:name,matchedAddress:`${street}, ${postal}`,sourceUrl:url,rating:number(aggregate.ratingValue,1,5),totalReviews:number(aggregate.reviewCount,0,Number.MAX_SAFE_INTEGER,true),note:'Name, street address, and ZIP matched. Written reviews and individual overall bubble ratings read from the page captured by Nimble.'},reviews);
}
