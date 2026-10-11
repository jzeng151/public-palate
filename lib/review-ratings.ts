import { platformNames, type Analysis } from './review-model.ts';

// Use the displayed precision so a score shown as 4.0 is always in the high band.
export function ratingBand(rating:number){
  const displayed=Number(rating.toFixed(1));
  return displayed>=4?'high':displayed>=3?'medium':'low';
}

export function providerRatings(platforms:Analysis['platforms']){
  const providers=platformNames.map(platform=>{
    const source=platforms.find(item=>item.platform===platform&&item.match==='confirmed');
    const rating=source?.rating;
    return {platform,rating:typeof rating==='number'&&Number.isFinite(rating)&&rating>=1&&rating<=5?rating:null,totalReviews:source?.totalReviews??null,ratingBasis:source?.ratingBasis};
  });
  const available=providers.filter(provider=>provider.rating!==null);
  return {providers,availableCount:available.length,average:available.length?available.reduce((sum,provider)=>sum+provider.rating!,0)/available.length:null};
}
