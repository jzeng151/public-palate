import { restaurantById } from '@/lib/catalog';
import { runReviewPipeline } from '@/lib/review-pipeline';
import type { ReviewReport } from '@/lib/review-model';

const cache=new Map<string,{report:ReviewReport;expires:number}>();
const active=new Set<string>();
const recent:number[]=[];

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Use the review button in the app.'},{status:403});
  let body:{id?:string;engine?:string;refresh?:boolean};
  try{body=await request.json();}catch{return Response.json({error:'Invalid request.'},{status:400});}
  if(!body||typeof body!=='object'||typeof body.id!=='string'||(body.engine!==undefined&&!['nimble','gemini'].includes(body.engine))||(body.refresh!==undefined&&typeof body.refresh!=='boolean'))return Response.json({error:'Invalid review request.'},{status:400});
  const restaurant=restaurantById.get(body.id);
  if(!restaurant)return Response.json({error:'Restaurant not found.'},{status:404});
  const engine=body.engine==='gemini'?'gemini':'nimble';
  if(!process.env.NIMBLE_API_KEY)return Response.json({error:'Add NIMBLE_API_KEY to .env.local and restart the dev server to collect live reviews.',code:'SETUP_REQUIRED'},{status:503});
  if(engine==='gemini'&&!process.env.GEMINI_API_KEY)return Response.json({error:'Add GEMINI_API_KEY to .env.local, or choose Nimble as the summary engine.',code:'SETUP_REQUIRED'},{status:503});
  const key=`${restaurant.id}:${engine}`;
  const hit=cache.get(key);
  if(hit&&hit.expires>Date.now()&&!body.refresh)return Response.json({...hit.report,cached:true});
  if(active.has(key))return Response.json({error:'Reviews are already being collected for this restaurant. Please wait.'},{status:409});
  while(recent.length&&recent[0]<Date.now()-60000)recent.shift();
  if(active.size>=3||recent.length>=10)return Response.json({error:'Several collections are running. Try again in a minute.'},{status:429});
  active.add(key);recent.push(Date.now());
  const abort=new AbortController();
  const requestAbort=()=>abort.abort();
  request.signal.addEventListener('abort',requestAbort,{once:true});
  let closed=false;
  const stream=new ReadableStream({
    start(controller){
      const encoder=new TextEncoder();
      const send=(event:string,data:unknown)=>{if(!closed)controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));};
      const heartbeat=setInterval(()=>send('heartbeat',{}),15000);
      void runReviewPipeline(restaurant,engine,event=>send('progress',event),abort.signal).then(report=>{
        if(cache.size>=100)cache.delete(cache.keys().next().value!);
        if(report.reviews.length&&!report.analysisWarning)cache.set(key,{report,expires:Date.now()+3600000});send('result',report);
      }).catch(error=>{
        if(!abort.signal.aborted)send('error',{message:error instanceof Error?error.message:'Review collection failed. Please try again.'});
      }).finally(()=>{
        active.delete(key);clearInterval(heartbeat);request.signal.removeEventListener('abort',requestAbort);
        if(!closed){closed=true;controller.close();}
      });
    },
    cancel(){closed=true;abort.abort();}
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'}});
}
