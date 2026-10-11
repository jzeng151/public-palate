'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Bookmark,Check,ChevronDown,ExternalLink,LoaderCircle,MapPin,Phone,ShieldCheck,X} from 'lucide-react';
import type {Restaurant} from '@/lib/restaurant-data';
import {DATASET_PAGE} from '@/lib/restaurant-data';
import {cuisinePhoto,formatDate,gradeDetails} from '@/lib/presentation';
import {GradeCard} from './grade-card';
import {ReviewPanel} from './review-panel';

type Inspection={date:string;type:string;grade:string|null;score:number|null;action:string;violations:{code:string;description:string;critical:boolean}[]};
export function RestaurantDetail({restaurant,saved,onSave,onClose,configuration}:{restaurant:Restaurant;saved:boolean;onSave:()=>void;onClose:()=>void;configuration:{nimble:boolean;gemini:boolean}}){
  const [tab,setTab]=useState<'reviews'|'inspections'>('reviews');
  const [inspections,setInspections]=useState<Inspection[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [phone,setPhone]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      document.getElementById(`restaurant-${restaurant.id}`)?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      document.getElementById(`restaurant-heading-${restaurant.id}`)?.focus({preventScroll:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[restaurant.id]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setMessage('');
    fetch(`/api/restaurants/${restaurant.id}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Inspection history could not be loaded.');return r.json() as Promise<{inspections:Inspection[];phone:string|null;message?:string}>;}).then(data=>{setInspections(data.inspections);setPhone(data.phone);setMessage(data.message||'');}).catch(e=>{if(!controller.signal.aborted)setMessage(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[restaurant.id,retry]);
  const closed=inspections[0]?.action.toLowerCase().includes('closed');
  const info=gradeDetails(restaurant.grade);
  return <section className="restaurant-detail" id={`restaurant-${restaurant.id}`} aria-labelledby={`restaurant-heading-${restaurant.id}`}>
    <button className="detail-close icon-button" aria-label="Close restaurant details" onClick={onClose}><X size={21}/></button>
    <div className="detail-identity">
      <figure className="detail-image"><img src={`/images/${cuisinePhoto(restaurant.cuisine)}.jpg`} alt={`Illustrative ${restaurant.cuisine.toLowerCase()} cuisine`}/><figcaption>Illustrative cuisine photo</figcaption></figure>
      <div className="detail-intro"><div className="detail-title-line"><h2 id={`restaurant-heading-${restaurant.id}`} tabIndex={-1}>{restaurant.name}</h2><button className={`save-button ${saved?'saved':''}`} aria-pressed={saved} onClick={onSave}><Bookmark size={16} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save'}</button></div><p className="detail-cuisine">{restaurant.cuisine} <span>·</span> {restaurant.borough}</p><p className="detail-address"><MapPin size={16}/>{restaurant.address}, {restaurant.borough}, NY {restaurant.zip}</p>
        <div className="detail-grade"><GradeCard grade={restaurant.grade}/><div><strong>{info.label}</strong><span>Latest recorded grade</span><span>{restaurant.gradeDate?`Issued ${formatDate(restaurant.gradeDate)}`:info.description}</span></div></div>
        {closed&&<p className="closure-notice">The latest inspection records a closure. Check the official record before visiting.</p>}
        <div className="detail-links"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address} ${restaurant.borough} NY ${restaurant.zip}`)}`} target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={15}/></a>{phone&&<a href={`tel:${phone.replace(/[^+\d]/g,'')}`}><Phone size={13}/> Call</a>}</div>
        <div className="detail-section-tabs" role="group" aria-label="Restaurant information"><button className={tab==='reviews'?'active':''} aria-pressed={tab==='reviews'} onClick={()=>setTab('reviews')}>Customer reviews</button><button className={tab==='inspections'?'active':''} aria-pressed={tab==='inspections'} onClick={()=>setTab('inspections')}><ShieldCheck size={14}/> Inspections</button></div>
        <p className="record-note">Health grades describe sanitary inspections. Customer stars describe diner experiences.</p>
      </div>
    </div>
    <div className="detail-content">{tab==='reviews'?<ReviewPanel key={restaurant.id} id={restaurant.id} name={restaurant.name} configuration={configuration}/>:<section className="inspection-panel"><div className="review-title"><div><h3>Behind the letter grade</h3><p>Inspection history from NYC Health.</p></div><a className="text-button" href={DATASET_PAGE} target="_blank" rel="noreferrer">Official dataset <ExternalLink size={13}/></a></div><p className="inspection-explainer">Lower inspection scores are better. A is 0 to 13 points, B is 14 to 27, and C is 28 or more. Some inspections receive a score without a new letter grade.</p>
      {loading&&<p className="loading-line" role="status"><LoaderCircle size={17} className="spin"/> Getting inspection records…</p>}
      {message&&<div className="error-notice" role="alert"><p>{message}</p><button className="text-button" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>}
      {!loading&&!message&&!inspections.length&&<p>No completed inspections are available in this dataset yet.</p>}
      {inspections.map((inspection,i)=><details className="inspection-entry" key={`${inspection.date}-${inspection.type}`} open={i===0}><summary><span><strong>{formatDate(inspection.date)}</strong><span>{inspection.type}</span></span><span className="inspection-score">{inspection.grade&&<span className={`grade-inline grade-${gradeDetails(inspection.grade).tone}`}>{gradeDetails(inspection.grade).short}</span>}{inspection.score!==null&&`${inspection.score} pts`}<ChevronDown size={15}/></span></summary><div className="inspection-body"><p>{inspection.action}</p>{inspection.violations.length?<ul>{inspection.violations.map(v=><li key={v.code}><span className="violation-code">{v.code}{v.critical&&<b>Critical</b>}</span><p>{v.description}</p></li>)}</ul>:<p><Check size={14}/> No violation details in this record.</p>}</div></details>)}
    </section>}</div>
  </section>;
}
