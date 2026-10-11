import type { Restaurant } from './restaurant-data.ts';

export const normalizeName=(input:string)=>input.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
// Catalog names can include legal or promotional words omitted by review sites.
// Address and ZIP must still match, regardless of these name differences.
const nameDescriptors=new Set(['the','inc','llc','famous','original']);
const nameTokens=(input:string)=>normalizeName(input).split(' ').filter(word=>word&&!nameDescriptors.has(word));
function street(input:string){
  const abbreviations:Record<string,string>={east:'e',west:'w',north:'n',south:'s',street:'st',avenue:'ave',boulevard:'blvd',road:'rd',drive:'dr',place:'pl',lane:'ln',parkway:'pkwy',highway:'hwy'};
  return normalizeName(input.split(',')[0]).split(' ').map(word=>abbreviations[word]||word).join(' ');
}
export function matchesRestaurant(restaurant:Restaurant,name:string,address:string,zip:string){
  const tokens=nameTokens(restaurant.name);
  const candidateTokens=nameTokens(name);
  const sameName=tokens.length>0&&tokens.filter(word=>candidateTokens.includes(word)).length/tokens.length>=0.75;
  const sameZip=!restaurant.zip||zip===restaurant.zip||new RegExp(`\\b${restaurant.zip}\\b`).test(address);
  return sameName&&street(address)===street(restaurant.address)&&sameZip;
}
