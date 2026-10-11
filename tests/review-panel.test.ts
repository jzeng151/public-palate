import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewPanel } from '../components/review-panel.tsx';

test('collection survives restaurant navigation and restores progress and completed reviews', async t => {
  const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost'});
  const globals = {window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
  const restoreGlobals:(()=>void)[]=[];
  for (const [key,value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    restoreGlobals.push(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else Reflect.deleteProperty(globalThis,key);});
  }
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  t.after(async () => {await act(async () => root.unmount()); dom.window.close(); restoreGlobals.forEach(restore=>restore());});
  let requests = 0;
  let requestSignal:AbortSignal;
  let stream:ReadableStreamDefaultController<Uint8Array>;
  t.mock.method(globalThis, 'fetch', async (_url:unknown, init:RequestInit) => {
    requests++;
    requestSignal = init.signal!;
    return new Response(new ReadableStream({start(controller){stream=controller;}}), {headers:{'Content-Type':'text/event-stream'}});
  });
  const render = (id:string) => act(async () => root.render(createElement(ReviewPanel, {key:id,id,name:id,configuration:{nimble:true,gemini:true}})));
  const send = (type:string,data:unknown) => act(async () => {
    stream.enqueue(new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
  });
  await render('navigation-joe');
  await act(async () => Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Read reviews'))!.click());
  await send('progress',{stage:'extract',platform:'Google',status:'running',message:'Collecting Joe reviews'});
  await render('navigation-katz');
  assert.equal(requestSignal!.aborted,false,'switching restaurants must not cancel collection');
  assert.doesNotMatch(container.textContent!,/Collecting Joe reviews/,'progress belongs to its restaurant');
  await render('navigation-joe');
  assert.match(container.textContent!,/Reading across the web/,'returning must show the active collection');
  assert.match(container.textContent!,/Collecting Joe reviews/,'returning must restore progress');
  assert.equal(requests,1,'returning must reuse the existing collection');
  await render('navigation-katz');
  await send('result',{
    engine:'gemini',collectedAt:'2026-10-11T00:00:00.000Z',platforms:[],sources:[],summaries:[],
    reviews:[{id:'navigation-review',platform:'Google',rating:5,text:'Synthetic review delivered while away',author:'Fixture diner',date:null,sourceUrl:'https://www.google.com/maps/'}],
  });
  await act(async ()=>stream.close());
  assert.doesNotMatch(container.textContent!,/Synthetic review delivered while away/);
  await render('navigation-joe');
  assert.match(container.textContent!,/Synthetic review delivered while away/,'offscreen completion must be retained');
  assert.doesNotMatch(container.textContent!,/Reading across the web/);
  assert.equal(requests,1);
});

test('provider failure stays visible after the analysis finishes and when a cached report reopens',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
  const previous=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const container=document.getElementById('root')!,root=createRoot(container);
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}});
  let stream:ReadableStreamDefaultController<Uint8Array>;
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(controller){stream=controller;}}),{headers:{'Content-Type':'text/event-stream'}}));
  const render=()=>act(async()=>root.render(createElement(ReviewPanel,{id:'persistent-error',name:'Thai Diner',configuration:{nimble:true,gemini:true}})));
  const send=(event:string,data:unknown)=>act(async()=>stream.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)));
  const message='Grubhub returned a country restriction page instead of reviews. Try refreshing reviews.';
  const visibleError=()=>Array.from(container.querySelectorAll('p,li')).some(node=>node.textContent?.includes(message)&&!node.closest('details:not([open])'));
  await render();
  await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Read reviews'))!.click());
  await send('progress',{stage:'extract',platform:'Grubhub',status:'error',message});
  assert.equal(visibleError(),true);
  await send('result',{engine:'gemini',collectedAt:'2026-10-11T00:00:00.000Z',platforms:[],reviews:[],summaries:[],sources:[{platform:'Grubhub',status:'unavailable',url:'https://www.grubhub.com/restaurant/fixture/123/reviews',title:'Grubhub',error:message}]});
  await act(async()=>stream.close());
  assert.equal(visibleError(),true,'analysis completion must not hide the provider failure in collapsed source details');
  await act(async()=>root.render(null));await render();
  assert.equal(visibleError(),true,'cached results must retain visible provider errors');
});
