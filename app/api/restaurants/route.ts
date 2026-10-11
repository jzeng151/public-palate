import { restaurants, cuisines, boroughs, catalogFetchedAt } from '@/lib/catalog';
import { filterRestaurants } from '@/lib/restaurant-data';

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedPage = Math.max(1,Math.floor(Number(params.get('page')) || 1));
  const limit = 12;
  let filtered = filterRestaurants(restaurants, params);
  if(params.get('ids')){
    const ids=new Set(params.get('ids')!.split(',').slice(0,500));
    filtered=filtered.filter(r=>ids.has(r.id));
  }
  if(params.get('sort')==='recent') filtered.sort((a,b)=>(b.gradeDate||'').localeCompare(a.gradeDate||'') || a.name.localeCompare(b.name));
  if(params.get('sort')==='explore'){
    const startingPlaces=['50017938','50125881','50060943','50169154','40732665','40575863'];
    filtered.sort((a,b)=>{const ai=startingPlaces.indexOf(a.id),bi=startingPlaces.indexOf(b.id);return (ai<0?100:ai)-(bi<0?100:bi)||a.name.localeCompare(b.name);});
  }
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(filtered.length / limit)));
  return Response.json({ restaurants:filtered.slice((page-1)*limit,page*limit), total:filtered.length, page, pages:Math.ceil(filtered.length/limit),
    cuisines, boroughs, fetchedAt:catalogFetchedAt, totalRestaurants:restaurants.length,
    configuration:{nimble:!!process.env.NIMBLE_API_KEY,gemini:!!process.env.GEMINI_API_KEY} });
}
