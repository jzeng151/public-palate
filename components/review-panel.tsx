'use client';

import {useMemo,useState,useSyncExternalStore} from 'react';
import {ArrowUpRight,ArrowRight,Check,ChevronDown,Download,ExternalLink,LoaderCircle,RefreshCw,Search,Star,StopCircle,Workflow} from 'lucide-react';
import {platformNames} from '@/lib/review-model';
import {getReviewCollection} from '@/lib/review-collection';
import {formatDate} from '@/lib/presentation';
import {ProviderRatings} from './provider-ratings';

export function ReviewPanel({id,name,configuration}:{id:string;name:string;configuration:{nimble:boolean;gemini:boolean}}){
  const collection=useMemo(()=>getReviewCollection(id,configuration.gemini?'gemini':'nimble'),[id,configuration.gemini]);
  const {report,events,loading,error,engine}=useSyncExternalStore(collection.subscribe,collection.getSnapshot,collection.getServerSnapshot);
  const collect=collection.start;
  const [platform,setPlatform]=useState('All');
  const [stars,setStars]=useState<number|null>(null);
  const reviews=report?.reviews.filter(r=>(platform==='All'||r.platform===platform)&&(stars===null||r.rating===stars))||[];
  const summary=report?.summaries.find(s=>s.platform===platform&&s.stars===stars);
  const groupReviews=report?.reviews.filter(r=>platform==='All'||r.platform===platform)||[];
  function exportReport(){
    if(!report)return;const blob=new Blob([JSON.stringify({restaurant:{id,name},...report},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`public-palate-${id}-reviews.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="reviews-panel" aria-label={`Reviews for ${name}`}>
    <div className="review-title"><div><h3>What people are saying</h3><p>Different platforms. A fuller picture.</p></div><span className="nimble-credit"><Workflow size={14}/> Powered by Nimble</span></div>
    {report&&<ProviderRatings platforms={report.platforms}/>}
    <div className="platform-tabs" role="group" aria-label="Review platform">
      {['All',...platformNames].map(p=><button key={p} aria-pressed={platform===p} onClick={()=>{setPlatform(p);setStars(null);}} className={platform===p?'active':''}>{p==='All'?'All platforms':p}{report&&<span>{report.reviews.filter(r=>p==='All'||r.platform===p).length}</span>}</button>)}
    </div>
    <div className="rating-filters" role="group" aria-label="Filter reviews by star rating">
      <button className={stars===null?'active':''} aria-pressed={stars===null} onClick={()=>setStars(null)}>All ratings</button>
      {[5,4,3,2,1].map(star=><button className={stars===star?'active':''} aria-pressed={stars===star} aria-label={`${star} star reviews`} key={star} onClick={()=>setStars(star)}>{star}<Star size={12} fill="currentColor"/></button>)}
    </div>
    {!report&&!loading&&<div className="review-empty">
      <div className="empty-review-icon"><Search size={27}/><Star size={15}/></div>
      <h4>{stars?`The story behind ${stars}-star reviews`:'The reviews, without the tab hopping.'}</h4>
      <p>Collect public reviews from Google, Yelp, and Grubhub. See what diners agree on, then look closer by platform or star rating.</p>
      <div className="collect-controls"><button className="button-primary" onClick={()=>collect()}>Read reviews <ArrowRight size={16}/></button><label className="engine-select">Summarize with<select aria-label="Summary engine" value={engine} onChange={e=>collection.setEngine(e.target.value as 'nimble'|'gemini')}><option value="nimble">Nimble</option><option value="gemini">Gemini</option></select></label></div>
      {!configuration.nimble&&<p className="setup-note">Live reviews need a Nimble API key. <a href="#setup" onClick={e=>{e.preventDefault();document.getElementById(`setup-${id}`)?.setAttribute('open','');document.getElementById(`setup-${id}`)?.scrollIntoView({behavior:'smooth',block:'nearest'});}}>View local setup</a></p>}
    </div>}
    {loading&&<div className="collection-status" role="status" aria-live="polite"><div className="collection-heading"><LoaderCircle className="spin" size={23}/><div><h4>Reading across the web</h4><p>{events.at(-1)?.message||'Starting review collection…'}</p></div><button className="text-button" onClick={collection.stop}><StopCircle size={15}/> Stop</button></div><ol className="pipeline-stages">{platformNames.map(p=>{const event=[...events].reverse().find(e=>e.platform===p);return <li key={p}><span className={`status-dot ${event?.status||''}`}/><strong>{p}</strong><span>{event?.message||'Waiting to start'}</span></li>;})}</ol><p className="subtle">You can browse other restaurants while this runs. Return here to see progress and results.</p></div>}
    {error&&<div className="error-notice" role="alert"><p>{error}</p>{!loading&&<button className="text-button" onClick={()=>collect(Boolean(report))}>Try again <RefreshCw size={14}/></button>}</div>}
    {report&&<div className="review-results">
      {report.analysisWarning&&<div className="error-notice" role="status"><p>Reviews were collected, but the summary is unavailable. {report.analysisWarning}</p></div>}
      <div className="sample-meta"><span>{reviews.length} collected {reviews.length===1?'review':'reviews'}{stars?` · ${stars} stars`:''}</span></div>
      {summary?<div className="summary"><span className="summary-label"><Check size={14}/> Review summary · {report.engine==='gemini'?'Gemini':'Nimble'}</span><p>{summary.text}</p><div className="summary-columns">{summary.praise.length>0&&<div><h4>Diners liked</h4><ul>{summary.praise.map((p,i)=><li key={i}>{p}</li>)}</ul></div>}{summary.concerns.length>0&&<div><h4>Worth knowing</h4><ul>{summary.concerns.map((p,i)=><li key={i}>{p}</li>)}</ul></div>}</div><div className="summary-evidence">Based on {summary.evidenceIds.length} collected reviews. <a href={`#review-${summary.evidenceIds[0]}`}>See the evidence <ArrowUpRight size={12}/></a></div></div>:<div className="no-summary"><h4>{reviews.length?'Review evidence is available':'No collected reviews in this group'}</h4><p>{reviews.length?'A supported summary was not returned for this group. You can read the original excerpts below.':'Try all ratings or another platform. A missing sample does not mean the restaurant has no reviews.'}</p></div>}
      {groupReviews.some(r=>r.rating!==null)&&<details className="sample-distribution"><summary>Star distribution of collected reviews <ChevronDown size={14}/></summary><div>{[5,4,3,2,1].map(star=>{const count=groupReviews.filter(r=>r.rating===star).length;return <button key={star} className="histogram-row" onClick={()=>setStars(star)}><span>{star}<Star size={11}/></span><span className="histogram-track"><span style={{width:`${count/groupReviews.length*100}%`}}/></span><span>{count}</span></button>;})}</div><p>Collected sample only. This is not the platform’s full rating distribution.</p></details>}
      {reviews.length>0&&<div className="review-excerpts"><h4>From the original reviews</h4>{reviews.slice(0,12).map(review=><article className="review-excerpt" id={`review-${review.id}`} key={review.id}><div className="review-byline"><span className="review-avatar">{review.author.slice(0,1).toUpperCase()}</span><div><strong>{review.author}</strong><span>{review.platform}{review.date?` · ${review.date}`:''}</span></div>{review.rating!==null&&<span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{Array.from({length:review.rating},(_,i)=><Star size={12} fill="currentColor" key={i}/>)}</span>}</div><blockquote>{review.text}</blockquote><a href={review.sourceUrl} target="_blank" rel="noreferrer">Read on {review.platform} <ExternalLink size={12}/></a></article>)}{reviews.length>12&&<p className="subtle">Showing 12 of {reviews.length} excerpts. Download the collected data for the full sample.</p>}</div>}
      <details className="source-details"><summary><Workflow size={15}/> Sources & collection details <ChevronDown size={14}/></summary><p>Collected {formatDate(report.collectedAt)}. Summaries describe a sample, not every review on a platform.</p>{report.sources.map(source=><div className="source-row" key={source.platform}><strong>{source.platform}</strong><span>{source.status==='collected'?'Page collected':'Unavailable'}</span>{source.url&&<a href={source.url} target="_blank" rel="noreferrer">Source <ExternalLink size={12}/></a>}<p>{report.platforms.find(p=>p.platform===source.platform)?.note||source.error}</p></div>)}<div className="source-actions"><button className="text-button" onClick={exportReport}><Download size={14}/> Download JSON</button><button className="text-button" disabled={loading} onClick={()=>collect(true)}><RefreshCw size={14}/> Refresh reviews</button></div></details>
    </div>}
    {!configuration.nimble&&<details className="setup-details" id={`setup-${id}`}><summary>Local review setup <ChevronDown size={14}/></summary><p>Add <code>NIMBLE_API_KEY</code> to <code>.env.local</code> in the project, then restart <code>npm run dev</code>. To use Gemini for summaries, also add <code>GEMINI_API_KEY</code>. Keys stay on the server.</p></details>}
  </section>;
}
