import fs from 'node:fs/promises';

const fields = ['camis','dba','boro','building','street','zipcode','cuisine_description','grade','grade_date'];
const rows=[];
for(let offset=0;;offset+=40000){
  const url = new URL('https://data.cityofnewyork.us/resource/43nn-pn8j.json');
  url.search = new URLSearchParams({
    '$select':`${fields.join(',')},max(inspection_date) as inspection_date,max(record_date) as record_date`,
    '$group':fields.join(','), '$order':'camis,grade_date,grade', '$limit':'40000', '$offset':String(offset)
  }).toString();
  const response=await fetch(url,{headers:process.env.SOCRATA_APP_TOKEN?{'X-App-Token':process.env.SOCRATA_APP_TOKEN}:{},signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`NYC dataset returned ${response.status}`);
  const page=await response.json(); rows.push(...page);
  console.log(`Fetched ${rows.length} inspection groups`);
  if(page.length<40000)break;
}
const {consolidateRestaurants}=await import('../lib/restaurant-data.ts');
const restaurants=consolidateRestaurants(rows);
await fs.mkdir('data',{recursive:true});
const snapshot={fetchedAt:new Date().toISOString(),source:'NYC Open Data · DOHMH',restaurants};
await fs.writeFile('data/restaurants.json',JSON.stringify(snapshot));
console.log(`Saved ${restaurants.length} restaurants. ${Buffer.byteLength(JSON.stringify(snapshot))} bytes.`);
