import type { Restaurant } from './restaurant-data.ts';

export const normalizeName=(input:string)=>input.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
// Catalog names can include legal or promotional words omitted by review sites.
// Address and ZIP must still match, regardless of these name differences.
const nameDescriptors=new Set(['the','inc','llc','famous','original','restaurant']);
const nameTokens=(input:string)=>normalizeName(input).split(' ').filter(word=>word&&!nameDescriptors.has(word));
export function normalizeStreet(input:string){
  const abbreviations:Record<string,string>={east:'e',west:'w',north:'n',south:'s',street:'st',avenue:'ave',boulevard:'blvd',road:'rd',drive:'dr',place:'pl',lane:'ln',parkway:'pkwy',highway:'hwy'};
  return normalizeName(input.split(',')[0]).replace(/\b(\d+)(?:st|nd|rd|th)\b/g,'$1').split(' ').map(word=>abbreviations[word]||word).join(' ');
}
export function matchesRestaurantName(expected:string,name:string){
  const expectedNumbers=new Set(normalizeName(expected).match(/\d+/g)||[]);
  const candidateNumbers=new Set(normalizeName(name).match(/\d+/g)||[]);
  if(expectedNumbers.size!==candidateNumbers.size||Array.from(expectedNumbers).some(number=>!candidateNumbers.has(number)))return false;
  const tokens=nameTokens(expected);
  const candidateTokens=nameTokens(name);
  // A real name such as "The Restaurant" can consist entirely of descriptors.
  // In that case require the full normalized name, rather than a partial generic match.
  if(!tokens.length||!candidateTokens.length)return Boolean(normalizeName(expected))&&normalizeName(expected)===normalizeName(name);
  return tokens.filter(word=>candidateTokens.includes(word)).length/tokens.length>=0.75;
}
export function matchesRestaurant(restaurant:Restaurant,name:string,address:string,zip:string){
  const sameName=matchesRestaurantName(restaurant.name,name);
  const sameZip=/^\d{5}$/.test(restaurant.zip)&&(zip===restaurant.zip||new RegExp(`\\b${restaurant.zip}\\b`).test(address));
  return sameName&&normalizeStreet(address)===normalizeStreet(restaurant.address)&&sameZip;
}
