import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRestaurant } from '../lib/restaurant-match.ts';
import type { Restaurant } from '../lib/restaurant-data.ts';

const restaurant:Restaurant={id:'fixture',name:"The Original John's Pizzeria LLC",address:'1 East Test Street',borough:'Manhattan',zip:'10001',cuisine:'Pizza',grade:'A',gradeDate:null,inspectionDate:null,recordDate:null};
test('normalizes business descriptors without accepting different businesses or locations',()=>{
  assert.equal(matchesRestaurant(restaurant,"John's Pizzeria",'1 E Test St','10001'),true);
  assert.equal(matchesRestaurant({...restaurant,name:"John's Pizzeria"},"Famous John's Pizzeria Inc",'1 E Test St','10001'),true);
  assert.equal(matchesRestaurant(restaurant,"John's Pizzeria",'2 E Test St','10001'),false);
  assert.equal(matchesRestaurant(restaurant,"John's Pizzeria",'1 E Test St','10002'),false);
  assert.equal(matchesRestaurant(restaurant,"Mario's Pizzeria",'1 E Test St','10001'),false);
  assert.equal(matchesRestaurant({...restaurant,name:'The Original Inc'},'The Famous LLC','1 E Test St','10001'),false);
});

test('normalizes numeric street ordinals and the restaurant descriptor without accepting another address',()=>{
  const expected={...restaurant,name:"Sardi's Restaurant",address:'234 West 44 Street',zip:'10036'};
  assert.equal(matchesRestaurant(expected,"Sardi’s",'234 W 44th St','10036'),true);
  assert.equal(matchesRestaurant(expected,"Sardi’s",'234 W 45th St','10036'),false);
  assert.equal(matchesRestaurant(expected,'Other Restaurant','234 W 44th St','10036'),false);
});
