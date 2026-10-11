import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewCollection } from '../lib/review-collection.ts';
import type { ReviewReport } from '../lib/review-model.ts';

const report=(engine:'nimble'|'gemini'='gemini'):ReviewReport=>({engine,collectedAt:'2026-10-11T00:00:00.000Z',platforms:[],reviews:[],summaries:[],sources:[]});
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
const encode=(event:string,data:unknown)=>new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

test('deduplicates starts while keeping concurrent restaurants and engine choices separate',async t=>{
  const requests=new Map<string,{signal:AbortSignal;body:{engine:string};stream:ReadableStreamDefaultController<Uint8Array>}>();
  let count=0;
  t.mock.method(globalThis,'fetch',async (_url:unknown,init:RequestInit)=>{
    count++;const body=JSON.parse(String(init.body));
    return new Response(new ReadableStream({start(stream){requests.set(body.id,{signal:init.signal!,body,stream});}}),{headers:{'Content-Type':'text/event-stream'}});
  });
  const joe=createReviewCollection('joe','gemini'),katz=createReviewCollection('katz','gemini');
  joe.setEngine('nimble');
  const joeDone=joe.start(),duplicate=joe.start(),katzDone=katz.start();
  assert.equal(duplicate,joeDone);assert.equal(count,2);
  assert.equal(requests.get('joe')?.body.engine,'nimble');assert.equal(requests.get('katz')?.body.engine,'gemini');
  joe.setEngine('gemini');assert.equal(joe.getSnapshot().engine,'nimble','cannot switch the engine mid-collection');
  await tick();
  requests.get('joe')!.stream.enqueue(encode('result',report('nimble')));requests.get('joe')!.stream.close();
  await joeDone;
  assert.equal(joe.getSnapshot().report?.engine,'nimble');assert.equal(joe.getSnapshot().loading,false);
  assert.equal(katz.getSnapshot().loading,true);assert.equal(katz.getSnapshot().report,null);
  katz.stop();await katzDone;
  assert.equal(requests.get('katz')!.signal.aborted,true);
  assert.match(katz.getSnapshot().error,/Collection stopped/);
});

test('explicit stop cancels the stream and a stale response cannot overwrite a new collection',async t=>{
  const pending:{signal:AbortSignal;resolve:(response:Response)=>void}[]=[];
  t.mock.method(globalThis,'fetch',(_url:unknown,init:RequestInit)=>new Promise<Response>(resolve=>pending.push({signal:init.signal!,resolve})));
  const collection=createReviewCollection('stop-restart','gemini');
  const stopped=collection.start();collection.stop();
  assert.equal(pending[0].signal.aborted,true);assert.equal(collection.getSnapshot().loading,false);
  const restarted=collection.start();
  pending[0].resolve(Response.json({...report(),analysisWarning:'Stale result'}));await stopped;
  assert.equal(collection.getSnapshot().loading,true);assert.equal(collection.getSnapshot().report,null);
  pending[1].resolve(Response.json(report()));await restarted;
  assert.equal(collection.getSnapshot().report?.analysisWarning,undefined);
  assert.equal(collection.getSnapshot().error,'');assert.equal(collection.getSnapshot().loading,false);
});

test('handles split stream events and preserves a report if its refresh fails',async t=>{
  let count=0;
  t.mock.method(globalThis,'fetch',async ()=>{
    if(++count===2)return Response.json({error:'Temporary provider problem'},{status:503});
    const bytes=encode('result',report());
    return new Response(new ReadableStream({start(stream){stream.enqueue(bytes.slice(0,17));stream.enqueue(bytes.slice(17));stream.close();}}),{headers:{'Content-Type':'text/event-stream'}});
  });
  const collection=createReviewCollection('refresh','gemini');
  await collection.start();assert.equal(collection.getSnapshot().report?.engine,'gemini');
  await collection.start(true);
  assert.equal(count,2);assert.equal(collection.getSnapshot().report?.engine,'gemini');
  assert.match(collection.getSnapshot().error,/Temporary provider/);assert.equal(collection.getSnapshot().loading,false);
});
