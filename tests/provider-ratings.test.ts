import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { ProviderRatings } from '../components/provider-ratings.tsx';
import type { Analysis } from '../lib/review-model.ts';

test('shows each overall rating, equal aggregate, coverage, and missing provider without inventing zero',()=>{
  const common={match:'confirmed' as const,matchedName:'Fixture',matchedAddress:'1 Test Street',sourceUrl:'',note:''};
  const platforms:Analysis['platforms']=[{...common,platform:'Google',rating:4.8,totalReviews:10000},{...common,platform:'Yelp',rating:3.6,totalReviews:5}];
  const dom=new JSDOM(renderToStaticMarkup(createElement(ProviderRatings,{platforms})));
  const rows=Array.from(dom.window.document.querySelectorAll('dl>div')).map(row=>row.textContent);
  assert.match(rows[0]!,/All platforms4.2 \/ 52 of 3 providers/);
  assert.match(rows[1]!,/Google4.8 \/ 510,000 reviews/);
  assert.match(rows[2]!,/Yelp3.6 \/ 55 reviews/);
  assert.match(rows[3]!,/GrubhubUnavailable/);
  assert.match(dom.window.document.body.textContent!,/equally.*separate from the collected review sample/);
  dom.window.close();
});
