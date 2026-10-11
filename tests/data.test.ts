import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateRestaurants, displayName, filterRestaurants } from '../lib/restaurant-data.ts';
import { isPlatformUrl, validateAnalysis } from '../lib/review-model.ts';

test('consolidates repeated violations and selects newest issued grade before filtering',()=>{
  const common={camis:'123',dba:"JOE'S PIZZA",boro:'MANHATTAN',building:'7',street:'CARMINE  STREET',cuisine_description:'Pizza'};
  const rows=[
    {...common,grade:'A',grade_date:'2025-01-01',inspection_date:'2025-01-01'},
    {...common,grade:'C',grade_date:'2026-02-01',inspection_date:'2026-02-01',violation_code:'01A'},
    {...common,grade:'C',grade_date:'2026-02-01',inspection_date:'2026-02-01',violation_code:'02A'},
    {...common,inspection_date:'2026-03-01'},
  ];
  const restaurants=consolidateRestaurants(rows);
  assert.equal(restaurants.length,1);
  assert.equal(restaurants[0].grade,'C');
  assert.equal(restaurants[0].inspectionDate,'2026-03-01');
  assert.equal(restaurants[0].gradeDate,'2026-02-01');
  assert.equal(filterRestaurants(restaurants,new URLSearchParams({grades:'A'})).length,0);
  assert.equal(filterRestaurants(restaurants,new URLSearchParams({grades:'C',cuisine:'Pizza',q:'carmine'})).length,1);
  assert.equal(restaurants[0].address,'7 Carmine Street');
  assert.equal(restaurants[0].name,"Joe's Pizza");
});
test('does not show 1900 placeholder as a real inspection and preserves pending grades',()=>{
  const restaurants=consolidateRestaurants([{camis:'1',dba:'NEW',inspection_date:'1900-01-01'},{camis:'2',dba:'PENDING',grade:'A',grade_date:'2025-01-01'},{camis:'2',dba:'PENDING',grade:'Z',grade_date:'2026-01-01'}]);
  assert.equal(restaurants[0].inspectionDate,null);
  assert.equal(restaurants[1].grade,'Z');
  assert.equal(filterRestaurants(restaurants,new URLSearchParams({grades:'pending'})).length,2);
  assert.equal(displayName("L'INDUSTRIE"),"L'industrie");
});
test('only permits public restaurant listing URLs for the expected platform',()=>{
  assert.equal(isPlatformUrl('https://www.yelp.com/biz/restaurant','Yelp'),true);
  for(const url of ['https://yelp.com.evil.test/biz/a','http://yelp.com/biz/a','https://x:y@yelp.com/biz/a','https://yelp.com:8443/biz/a','https://localhost/biz/a','https://yelp.com/search'])assert.equal(isPlatformUrl(url,'Yelp'),false);
  assert.equal(isPlatformUrl('https://www.google.com/maps/place/Test','Google'),true);
  assert.equal(isPlatformUrl('https://google.com/search?q=test','Google'),false);
});
test('rejects invented or duplicate review text and summaries outside their evidence tier',()=>{
  const url='https://www.yelp.com/biz/example';
  const base={platform:'Yelp',rating:5,text:'The noodles were excellent.',author:'A',date:null,sourceUrl:url};
  const input={platforms:[{platform:'Yelp',match:'confirmed',matchedName:'Example',matchedAddress:'1 Test St',sourceUrl:url,rating:4.5,totalReviews:100,note:''}],reviews:[
    {...base,id:'r1'},{...base,id:'r2'},{...base,id:'r3',text:'A completely invented review.'}
  ],summaries:[
    {platform:'Yelp',stars:5,text:'Praise in the collected sample.',praise:['Noodles'],concerns:[],evidenceIds:['r1']},
    {platform:'Yelp',stars:1,text:'Wrong tier',praise:[],concerns:[],evidenceIds:['r1']},
    {platform:'Google',stars:null,text:'Wrong platform',praise:[],concerns:[],evidenceIds:['r1']},
    {platform:'All',stars:null,text:'Invented evidence',praise:[],concerns:[],evidenceIds:['r3']}
  ]};
  const result=validateAnalysis(input,[{platform:'Yelp',url,title:'Example',content:'A said: The noodles were excellent.',status:'collected'}]);
  assert.equal(result.reviews.length,1);
  assert.equal(result.summaries.length,1);
  const uncertain=structuredClone(input);uncertain.platforms[0].match='uncertain';
  assert.equal(validateAnalysis(uncertain,[{platform:'Yelp',url,title:'Example',content:base.text,status:'collected'}]).reviews.length,0);
});
