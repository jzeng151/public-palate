import { z } from 'zod';

export const platformNames = ['Google','Yelp','Grubhub','Tripadvisor','OpenTable'] as const;
export type Platform = typeof platformNames[number];
export const reviewSchema = z.object({
  id:z.string().min(1), platform:z.enum(platformNames), rating:z.number().int().min(1).max(5).nullable(),
  text:z.string().min(1).max(4000), author:z.string().max(160), date:z.string().nullable(), sourceUrl:z.string().url()
});
export const analysisSchema=z.object({
  platforms:z.array(z.object({
    platform:z.enum(platformNames), match:z.enum(['confirmed','uncertain','not_found']),
    matchedName:z.string(),matchedAddress:z.string(),sourceUrl:z.string(),
    rating:z.number().min(0).max(5).nullable(),totalReviews:z.number().int().nonnegative().nullable(),
    note:z.string().max(1200),ratingBasis:z.enum(['recent','all_time']).optional()
  })),
  reviews:z.array(reviewSchema).max(150),
  summaries:z.array(z.object({
    platform:z.enum(['All',...platformNames]),stars:z.number().int().min(1).max(5).nullable(),
    text:z.string().max(2000),praise:z.array(z.string()).max(5),concerns:z.array(z.string()).max(5),
    evidenceIds:z.array(z.string())
  })).max((platformNames.length+1)*6)
});
export type Review= z.infer<typeof reviewSchema>;
export type Analysis=z.infer<typeof analysisSchema>;
export type SourcePage={platform:Platform;url:string;title:string;content:string;status:'collected'|'unavailable';error?:string;structured?:{platform:Analysis['platforms'][number];reviews:Review[]}};
export type PipelineEvent={stage:'search'|'extract'|'summarize';platform?:Platform;status:'running'|'complete'|'error';message:string};
export type ReviewReport=Analysis & {collectedAt:string;engine:string;sources:Omit<SourcePage,'content'|'structured'>[];cached?:boolean;analysisWarning?:string};

const string={type:'string'};
// Nimble structured outputs permit depth <= 5 and disallow min/max/format keywords.
export const analysisJsonSchema={type:'object',properties:{
  platforms:{type:'array',items:{type:'object',properties:{platform:{type:'string',enum:platformNames},match:{type:'string',enum:['confirmed','uncertain','not_found']},matchedName:string,matchedAddress:string,sourceUrl:string,rating:{type:['number','null']},totalReviews:{type:['integer','null']},note:string},required:['platform','match','matchedName','matchedAddress','sourceUrl','rating','totalReviews','note']}},
  reviews:{type:'array',items:{type:'object',properties:{id:string,platform:{type:'string',enum:platformNames},rating:{type:['integer','null']},text:string,author:string,date:{type:['string','null']},sourceUrl:string},required:['id','platform','rating','text','author','date','sourceUrl']}},
  summaries:{type:'array',items:{type:'object',properties:{platform:{type:'string',enum:['All',...platformNames]},stars:{type:['integer','null']},text:string,praise:{type:'array',items:string},concerns:{type:'array',items:string},evidenceIds:{type:'array',items:string}},required:['platform','stars','text','praise','concerns','evidenceIds']}}
},required:['platforms','reviews','summaries']};

export const platformDomains:Record<Platform,string[]>={Google:['google.com'],Yelp:['yelp.com'],Grubhub:['grubhub.com'],Tripadvisor:['tripadvisor.com'],OpenTable:['opentable.com']};
function isOpenTableListingPath(path:string){
  if(/^\/(?:r\/[a-z0-9-]+|restaurant\/profile\/\d+(?:\/reserve)?)\/?$/i.test(path))return true;
  // Legacy listings use a root slug, but city/category directories do too.
  return /^\/[a-z0-9-]+\/?$/i.test(path)&&
    !/^\/(?:start|s|r|home|metro|city|region|restaurants|about|login|signup|dining-rewards|private-dining)\/?$/i.test(path)&&
    !/(?:\/|-)restaurants(?:-|\/?$)/i.test(path);
}
export function isPlatformUrl(raw:string,platform:Platform){
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
    return platformDomains[platform].some(d=>url.hostname===d||url.hostname.endsWith(`.${d}`)) &&
      (platform!=='Google'||url.pathname.startsWith('/maps')) &&
      (platform!=='Yelp'||url.pathname.startsWith('/biz/')) &&
      (platform!=='Grubhub'||url.pathname.startsWith('/restaurant/')) &&
      (platform!=='Tripadvisor'||/^\/Restaurant_Review-g\d+-d\d+-Reviews[^/]*\.html$/.test(url.pathname)) &&
      (platform!=='OpenTable'||isOpenTableListingPath(url.pathname));
  }catch{return false;}
}
export function validateAnalysis(input:unknown,sources:SourcePage[]):Analysis {
  const parsed=analysisSchema.parse(input);
  const collected=sources.filter(s=>s.status==='collected');
  // Structured provider reviews keep their original IDs, text, ratings and attribution.
  // The model can summarize these records, but cannot replace them or omit them.
  for(const source of collected){
    if(!source.structured)continue;
    parsed.platforms=parsed.platforms.filter(p=>p.platform!==source.platform).concat(source.structured.platform);
    parsed.reviews=parsed.reviews.filter(r=>r.platform!==source.platform).concat(source.structured.reviews);
  }
  const platforms=platformNames.map(platform=>{
    const p=parsed.platforms.find(p=>p.platform===platform);
    const source=collected.find(s=>s.platform===platform && s.url===p?.sourceUrl);
    if(!p||!source)return {platform,match:'uncertain' as const,matchedName:'',matchedAddress:'',sourceUrl:'',rating:null,totalReviews:null,note:sources.find(s=>s.platform===platform)?.error||'A matching collected source was not available.'};
    return p.match==='confirmed'?p:{...p,rating:null,totalReviews:null};
  });
  const confirmed=new Set(platforms.filter(p=>p.match==='confirmed').map(p=>p.platform));
  const seen=new Set<string>();
  const reviews=parsed.reviews.filter(r=>{
    const key=`${r.platform}:${r.text.toLowerCase().replace(/\s+/g,' ').trim()}`;
    const source=collected.find(s=>s.platform===r.platform&&s.url===r.sourceUrl);
    // Retain only verbatim evidence present on a collected page. Never publish invented model reviews.
    const normalize=(s:string)=>s.normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
    if(!source||!confirmed.has(r.platform)||seen.has(key)||seen.has(r.id)||!normalize(source.content).includes(normalize(r.text)))return false;
    seen.add(key);seen.add(r.id);return true;
  });
  const summaries=parsed.summaries.filter(s=>{
    const ids=new Set(reviews.filter(r=>(s.platform==='All'||r.platform===s.platform)&&(s.stars===null||r.rating===s.stars)).map(r=>r.id));
    return s.evidenceIds.length>0&&s.evidenceIds.every(id=>ids.has(id));
  });
  return {platforms,reviews,summaries};
}
