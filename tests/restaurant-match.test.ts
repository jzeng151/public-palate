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

test('preserves exact names made only of descriptors without matching unrelated generic names',()=>{
  const expected={...restaurant,name:'The Restaurant',address:'86-05 Rockaway Beach Boulevard',zip:'11693'};
  assert.equal(matchesRestaurant(expected,'The Restaurant','86-05 Rockaway Beach Blvd','11693'),true);
  assert.equal(matchesRestaurant(expected,'The Restaurant','86-06 Rockaway Beach Blvd','11693'),false);
  assert.equal(matchesRestaurant(expected,'The Restaurant','86-05 Rockaway Beach Blvd','11694'),false);
  assert.equal(matchesRestaurant(expected,'Other Restaurant','86-05 Rockaway Beach Blvd','11693'),false);
  assert.equal(matchesRestaurant(expected,'The Original Restaurant','86-05 Rockaway Beach Blvd','11693'),false);
  assert.equal(matchesRestaurant({...expected,name:'The Original Restaurant Inc'},'The Famous Restaurant LLC',expected.address,expected.zip),false);
  assert.equal(matchesRestaurant({...expected,name:'!!!'},'???',expected.address,expected.zip),false);
});

test('normalizes numeric street ordinals and the restaurant descriptor without accepting another address',()=>{
  const expected={...restaurant,name:"Sardi's Restaurant",address:'234 West 44 Street',zip:'10036'};
  assert.equal(matchesRestaurant(expected,"Sardi’s",'234 W 44th St','10036'),true);
  assert.equal(matchesRestaurant(expected,"Sardi’s",'234 W 45th St','10036'),false);
  assert.equal(matchesRestaurant(expected,'Other Restaurant','234 W 44th St','10036'),false);
});

test('does not confirm a location when the catalog ZIP is missing',()=>{
  const expected={...restaurant,zip:''};
  assert.equal(matchesRestaurant(expected,restaurant.name,restaurant.address,'10001'),false);
  assert.equal(matchesRestaurant(expected,restaurant.name,`${restaurant.address}, NY 10001`,'10001'),false);
});

test('requires numeric name identifiers to match even at the same address',()=>{
  const expected={...restaurant,name:'No.1 Favor Taste Restaurant',address:'732 61 Street',zip:'11220'};
  assert.equal(matchesRestaurant(expected,'No 2 Favor Taste Inc.','732 61st Street','11220'),false);
  assert.equal(matchesRestaurant(expected,'No 1 Favor Taste Inc.','732 61st Street','11220'),true);
  assert.equal(matchesRestaurant(expected,'No 1 Favor Taste 2','732 61st Street','11220'),false);
  assert.equal(matchesRestaurant({...expected,name:'Favor Taste'},'Favor Taste 2','732 61st Street','11220'),false);
});

test('allows an omitted marked store suffix while rejecting conflicting store identifiers',()=>{
  const expected={...restaurant,name:'Starbucks #20679',address:'1542 3 Avenue',zip:'10028'};
  assert.equal(matchesRestaurant(expected,'Starbucks','1542 3 Ave','10028'),true);
  assert.equal(matchesRestaurant(expected,'Starbucks Store #20679','1542 3 Ave','10028'),true);
  assert.equal(matchesRestaurant(expected,'Starbucks #20680','1542 3 Ave','10028'),false);
  assert.equal(matchesRestaurant(expected,'Starbucks','1543 3 Ave','10028'),false);
  assert.equal(matchesRestaurant(expected,'Starbucks','1542 3 Ave','10029'),false);
  assert.equal(matchesRestaurant({...expected,name:'Chipotle Mexican Grill # 3265'},'Chipotle Mexican Grill',expected.address,expected.zip),true);
  assert.equal(matchesRestaurant({...expected,name:'No.1 Favor Taste Restaurant'},'No 2 Favor Taste Inc.',expected.address,expected.zip),false);
});

test('does not match a shorter name to another colocated business with extra identifying words',()=>{
  const expected={...restaurant,name:'Bisoux Restaurant',address:'Laguardia Airport',zip:'11369'};
  assert.equal(matchesRestaurant(expected,'Bisoux Market, World Bean',expected.address,expected.zip),false);
  assert.equal(matchesRestaurant(expected,'Bisoux Market',expected.address,expected.zip),false);
  assert.equal(matchesRestaurant(expected,'Bisoux',expected.address,expected.zip),true);
  assert.equal(matchesRestaurant(expected,'Bisoux Restaurant',expected.address,expected.zip),true);
});
