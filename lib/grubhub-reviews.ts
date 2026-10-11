import { load } from 'cheerio/slim';
import type { Restaurant } from './restaurant-data.ts';
import type { Review, SourcePage } from './review-model.ts';
import { matchesRestaurant } from './restaurant-match.ts';

const value=(input:unknown)=>typeof input==='string'?input:typeof input==='number'?String(input):'';
type Business={name?:unknown;'@type'?:unknown;address?:{streetAddress?:unknown;postalCode?:unknown};aggregateRating?:{ratingValue?:unknown;reviewCount?:unknown}};

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
  if(!reviews.length)throw new Error('The Grubhub listing matched, but its written reviews did not finish loading. Try refreshing reviews.');
  const rating=Number(value(identity.aggregateRating?.ratingValue)),count=Number(value(identity.aggregateRating?.reviewCount));
  const platform={platform:'Grubhub' as const,match:'confirmed' as const,matchedName:value(identity.name).trim(),matchedAddress:`${value(identity.address?.streetAddress)}, ${value(identity.address?.postalCode)}`,sourceUrl:url,rating:value(identity.aggregateRating?.ratingValue)&&Number.isFinite(rating)&&rating>=0&&rating<=5?rating:null,totalReviews:value(identity.aggregateRating?.reviewCount)&&Number.isInteger(count)&&count>=0?count:null,note:'Name, street address, and ZIP matched. Reviews and per-review star icons read from the page rendered by Nimble.'};
  const content=[`Grubhub: ${platform.matchedName}`,`Address: ${platform.matchedAddress}`,`Source: ${url}`,`Platform rating: ${platform.rating}; total written reviews: ${platform.totalReviews}`,...reviews.map(review=>`Review ID: ${review.id}\nAuthor: ${review.author}\nRating: ${review.rating}\nDate: ${review.date}\n${review.text}`)].join('\n\n');
  return {platform:'Grubhub',url,title:platform.matchedName,content,status:'collected',structured:{platform,reviews}};
}
