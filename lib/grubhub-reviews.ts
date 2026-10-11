import { load } from 'cheerio/slim';
import type { Restaurant } from './restaurant-data.ts';
import { isPlatformUrl, type PipelineEvent, type Review, type SourcePage } from './review-model.ts';
import { matchesRestaurant } from './restaurant-match.ts';

const value=(input:unknown)=>typeof input==='string'?input:typeof input==='number'?String(input):'';
type Business={name?:unknown;'@type'?:unknown;address?:{streetAddress?:unknown;postalCode?:unknown};aggregateRating?:{ratingValue?:unknown;reviewCount?:unknown}};
class GrubhubReviewsPending extends Error {}

export function grubhubReviewUrl(raw:string){
  if(!isPlatformUrl(raw,'Grubhub'))throw new Error('Invalid Grubhub restaurant URL.');
  const url=new URL(raw);
  const base=url.pathname.match(/^(\/restaurant\/[^/]+\/\d+)(?:\/|$)/)?.[1];
  if(!base)throw new Error('Grubhub did not return a restaurant listing ID.');
  // Search can return /catering, /menu, or a deep link. Reviews belong to the ID.
  url.pathname=`${base}/reviews`;url.search='';url.hash='';
  return url.href;
}

type RequestJson=<T>(path:string,body:unknown,signal:AbortSignal,timeoutMs?:number)=>Promise<T>;
export async function collectGrubhubReviews(restaurant:Restaurant,url:string,request:RequestJson,notify:(event:PipelineEvent)=>void,signal:AbortSignal):Promise<SourcePage>{
  for(let attempt=0;attempt<2;attempt++){
    try{
      const result=await request<{status:string;status_code?:number;data?:{html?:string}}>('/extract',{
        url,formats:['html'],render:true,driver:attempt===0?'vx10':'vx10-pro',
        browser_actions:[{wait_for_element:{selector:'[data-testid="restaurant-review-item"] [data-testid="review-content"]',timeout:attempt===0?30000:45000}}],
        request_timeout:attempt===0?60000:90000
      },signal,attempt===0?90000:120000);
      const html=result.data?.html||'';
      const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
      if(/not available in your country/i.test(title))throw new Error('Grubhub returned a country restriction page instead of reviews. Try refreshing reviews.');
      if(/prepare your taste buds/i.test(title))throw new GrubhubReviewsPending('Grubhub returned its loading page before reviews were available. Try refreshing reviews.');
      if(result.status!=='success'||(result.status_code&&result.status_code>=400))throw Object.assign(new Error('Grubhub did not return readable review content.'),{status:result.status_code});
      const source=grubhubSource(restaurant,url,html);
      notify({stage:'extract',platform:'Grubhub',status:'complete',message:`${source.structured!.reviews.length} Grubhub reviews collected`});
      return source;
    }catch(error){
      const status=error&&typeof error==='object'&&'status' in error?Number(error.status):0;
      const retryable=error instanceof GrubhubReviewsPending||(error instanceof Error&&error.name==='TimeoutError')||status>=500;
      if(signal.aborted||attempt===1||!retryable)throw error;
      notify({stage:'extract',platform:'Grubhub',status:'running',message:'Retrying the Grubhub review page with a longer wait'});
    }
  }
  throw new Error('Grubhub review collection did not complete.');
}

// Parse the HTML collected by Nimble. Markdown drops the per-review star icons.
export function grubhubSource(restaurant:Restaurant,url:string,html:string):SourcePage{
  const $=load(html);
  let business:Business|undefined;
  $('script[type="application/ld+json"]').each((_,script)=>{
    try{
      const data=JSON.parse($(script).text());
      const candidates=Array.isArray(data)?data:Array.isArray(data?.['@graph'])?data['@graph']:[data];
      business||=candidates.find((item:Business)=>item?.['@type']==='Restaurant'&&matchesRestaurant(restaurant,value(item.name),value(item.address?.streetAddress),value(item.address?.postalCode)));
    }catch{/* Ignore malformed structured data, never execute page scripts. */}
  });
  if(!business)throw new Error('Grubhub did not provide a matching restaurant name, street address, and ZIP. No reviews from an uncertain location were used.');
  const identity:Business=business;
  const reviews:Review[]=[];
  const seen=new Set<string>();
  $('[data-testid="restaurant-review-item"]').each((_,element)=>{
    if(reviews.length>=30)return;
    const card=$(element),body=card.find('[data-testid="review-content"]');
    body.find('br').replaceWith('\n');
    const text=body.text().trim().slice(0,4000),key=text.toLowerCase().replace(/\s+/g,' ');
    if(!text||seen.has(key))return;
    seen.add(key);
    const author=card.find('[data-testid="review-reviewer-name"]');
    const stars=card.find('[data-testid="stars-static"] [data-testid="full-star"]').length;
    reviews.push({id:`grubhub-${reviews.length+1}`,platform:'Grubhub',text,rating:stars>=1&&stars<=5?stars:null,author:author.text().trim().slice(0,160)||'Anonymous',date:author.parent().next('span').text().trim()||null,sourceUrl:url});
  });
  if(!reviews.length)throw new GrubhubReviewsPending('The Grubhub listing matched, but its written reviews did not finish loading. Try refreshing reviews.');
  const rating=Number(value(identity.aggregateRating?.ratingValue)),count=Number(value(identity.aggregateRating?.reviewCount));
  const platform={platform:'Grubhub' as const,match:'confirmed' as const,matchedName:value(identity.name).trim(),matchedAddress:`${value(identity.address?.streetAddress)}, ${value(identity.address?.postalCode)}`,sourceUrl:url,rating:value(identity.aggregateRating?.ratingValue)&&Number.isFinite(rating)&&rating>=0&&rating<=5?rating:null,totalReviews:value(identity.aggregateRating?.reviewCount)&&Number.isInteger(count)&&count>=0?count:null,note:'Name, street address, and ZIP matched. Reviews and per-review star icons read from the page rendered by Nimble.'};
  const content=[`Grubhub: ${platform.matchedName}`,`Address: ${platform.matchedAddress}`,`Source: ${url}`,`Platform rating: ${platform.rating}; total written reviews: ${platform.totalReviews}`,...reviews.map(review=>`Review ID: ${review.id}\nAuthor: ${review.author}\nRating: ${review.rating}\nDate: ${review.date}\n${review.text}`)].join('\n\n');
  return {platform:'Grubhub',url,title:platform.matchedName,content,status:'collected',structured:{platform,reviews}};
}
