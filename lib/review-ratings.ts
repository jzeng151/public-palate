import { platformNames, type Analysis } from './review-model.ts';

export function providerRatings(platforms:Analysis['platforms']){
  const providers=platformNames.map(platform=>{
    const source=platforms.find(item=>item.platform===platform&&item.match==='confirmed');
    const rating=source?.rating;
    return {platform,rating:typeof rating==='number'&&Number.isFinite(rating)&&rating>=1&&rating<=5?rating:null,totalReviews:source?.totalReviews??null};
  });
  const available=providers.filter(provider=>provider.rating!==null);
  return {providers,availableCount:available.length,average:available.length?available.reduce((sum,provider)=>sum+provider.rating!,0)/available.length:null};
}
