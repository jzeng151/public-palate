import test from 'node:test';
import assert from 'node:assert/strict';
import { providerRatings, ratingBand } from '../lib/review-ratings.ts';
import type { Analysis, Platform } from '../lib/review-model.ts';

function provider(platform:Platform,rating:number|null,totalReviews:number,match:Analysis['platforms'][number]['match']='confirmed'):Analysis['platforms'][number]{
  return {platform,rating,totalReviews,match,matchedName:'Fixture',matchedAddress:'1 Test Street',sourceUrl:'',note:''};
}
test('averages provider-wide ratings equally despite different review counts',()=>{
  const result=providerRatings([provider('Google',4.8,10000),provider('Yelp',3.6,5),provider('Grubhub',4.2,80)]);
  assert.ok(Math.abs(result.average!-4.2)<0.000001);assert.equal(result.availableCount,3);
  assert.deepEqual(result.providers.map(p=>p.rating),[4.8,3.6,4.2,null,null]);
});
test('excludes missing and unconfirmed ratings instead of counting them as zero',()=>{
  const result=providerRatings([provider('Google',4.5,100),provider('Yelp',null,0),provider('Grubhub',1,30,'uncertain')]);
  assert.equal(result.average,4.5);assert.equal(result.availableCount,1);
  assert.deepEqual(result.providers.map(p=>p.rating),[4.5,null,null,null,null]);
  assert.equal(providerRatings([]).average,null);
  assert.equal(providerRatings([provider('Google',0,0)]).average,null);
});

test('score bands match displayed precision at the 3.0 and 4.0 boundaries',()=>{
  assert.equal(ratingBand(2.9),'low');
  assert.equal(ratingBand(3),'medium');
  assert.equal(ratingBand(3.9),'medium');
  assert.equal(ratingBand(3.96),'high');
  assert.equal(ratingBand(4),'high');
  assert.equal(ratingBand(5),'high');
});
