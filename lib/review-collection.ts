import type { PipelineEvent, ReviewReport } from './review-model.ts';

type Engine='nimble'|'gemini';
export type CollectionState={
  engine:Engine;
  report:ReviewReport|null;
  events:PipelineEvent[];
  loading:boolean;
  error:string;
};

// A collection belongs to the restaurant, not to the panel displaying it.
// Unsubscribing on navigation never aborts the request. Only Stop cancels it.
export function createReviewCollection(id:string,engine:Engine){
  const initial:CollectionState={engine,report:null,events:[],loading:false,error:''};
  let state=initial;
  const listeners=new Set<()=>void>();
  let current:{abort:AbortController;done:Promise<void>|null}|null=null;
  function update(patch:Partial<CollectionState>){
    state={...state,...patch};
    listeners.forEach(listener=>listener());
  }
  function start(refresh=false):Promise<void>{
    if(current)return current.done||Promise.resolve();
    const job={abort:new AbortController(),done:null as Promise<void>|null};
    current=job;
    const engine=state.engine;
    update({loading:true,error:'',events:[]});
    const isCurrent=()=>current===job&&!job.abort.signal.aborted;
    async function run(){
      try{
        const response=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,engine,refresh}),signal:job.abort.signal});
        if(!isCurrent())return;
        if(!response.ok){const data=await response.json() as {error?:string};throw new Error(data.error||'Review collection failed. Please try again.');}
        if(response.headers.get('content-type')?.includes('application/json')){
          const report=await response.json() as ReviewReport;
          if(isCurrent())update({report});
          return;
        }
        const reader=response.body?.getReader();
        if(!reader)throw new Error('The review stream did not open. Try again.');
        const cancel=()=>{void reader.cancel().catch(()=>{});};
        job.abort.signal.addEventListener('abort',cancel,{once:true});
        try{
          let buffer='';let received=false;
          const decoder=new TextDecoder();
          while(isCurrent()){
            const {value,done}=await reader.read();
            if(done||!isCurrent())break;
            buffer+=decoder.decode(value,{stream:true});
            let boundary;
            while((boundary=buffer.indexOf('\n\n'))>=0){
              const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
              const type=block.match(/^event: (.+)$/m)?.[1];
              const raw=block.match(/^data: (.+)$/m)?.[1];
              if(!raw)continue;
              const data=JSON.parse(raw);
              if(type==='progress')update({events:[...state.events.filter(event=>!(event.stage===data.stage&&event.platform===data.platform)),data]});
              if(type==='result'){received=true;update({report:data});}
              if(type==='error')throw new Error(data.message);
            }
          }
          if(isCurrent()&&!received)throw new Error('The connection ended before reviews were ready. Try again.');
        }finally{
          job.abort.signal.removeEventListener('abort',cancel);
          await reader.cancel().catch(()=>{});
          reader.releaseLock();
        }
      }catch(error){
        if(isCurrent())update({error:error instanceof Error?error.message:'Review collection failed. Try again.'});
      }finally{
        if(current===job){current=null;update({loading:false});}
      }
    }
    job.done=run();
    return job.done;
  }
  return {
    getSnapshot:()=>state,
    getServerSnapshot:()=>initial,
    subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
    setEngine(engine:Engine){if(!current&&engine!==state.engine)update({engine,report:null,events:[],error:''});},
    start,
    stop(){
      if(!current)return;
      const job=current;current=null;
      job.abort.abort();
      update({loading:false,error:'Collection stopped. You can start it again.'});
    },
  };
}

const collections=new Map<string,ReturnType<typeof createReviewCollection>>();
export function getReviewCollection(id:string,engine:Engine){
  // Server rendering has no active browser collection to restore.
  if(typeof window==='undefined')return createReviewCollection(id,engine);
  let collection=collections.get(id);
  if(!collection){collection=createReviewCollection(id,engine);collections.set(id,collection);}
  return collection;
}
