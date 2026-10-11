import { restaurantById } from '@/lib/catalog';
import { DATASET_URL, type InspectionRow } from '@/lib/restaurant-data';

export async function GET(_request: Request, {params}: {params:Promise<{id:string}>}) {
  const {id}=await params;
  const restaurant=restaurantById.get(id);
  if(!restaurant) return Response.json({error:'Restaurant not found.'},{status:404});
  try {
    const url=new URL(DATASET_URL);
    url.search=new URLSearchParams({'$where':`camis='${id}'`,'$order':'inspection_date DESC,grade_date DESC','$limit':'1000'}).toString();
    const response=await fetch(url,{headers:process.env.SOCRATA_APP_TOKEN?{'X-App-Token':process.env.SOCRATA_APP_TOKEN}:{},signal:AbortSignal.timeout(20000)});
    if(!response.ok) throw new Error('Dataset unavailable');
    const rows:InspectionRow[]=await response.json();
    const inspections=new Map<string,{date:string;type:string;grade:string|null;score:number|null;action:string;violations:{code:string;description:string;critical:boolean}[]}>();
    for(const row of rows){
      if(!row.inspection_date || row.inspection_date<'1900-01-02')continue;
      const key=`${row.inspection_date}:${row.inspection_type}`;
      const entry=inspections.get(key)||{date:row.inspection_date,type:row.inspection_type||'Inspection',grade:row.grade||null,score:row.score?Number(row.score):null,action:row.action||'',violations:[]};
      if(row.violation_code&&!entry.violations.some(v=>v.code===row.violation_code))entry.violations.push({code:row.violation_code,description:row.violation_description||'',critical:row.critical_flag==='Critical'});
      inspections.set(key,entry);
    }
    return Response.json({restaurant,inspections:[...inspections.values()].slice(0,12),phone:rows[0]?.phone||null,live:true});
  }catch{
    return Response.json({restaurant,inspections:[],phone:null,live:false,message:'Inspection history is temporarily unavailable. The catalog grade and date are still shown. Try again shortly.'});
  }
}
