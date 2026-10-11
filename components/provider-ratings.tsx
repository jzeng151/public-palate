import type { Analysis } from '@/lib/review-model';
import { providerRatings, ratingBand } from '@/lib/review-ratings';

export function ProviderRatings({platforms}:{platforms:Analysis['platforms']}){
  const {providers,average,availableCount}=providerRatings(platforms);
  const score=(rating:number|null)=>rating===null?<span className="rating-unavailable">Unavailable</span>:<span className={`rating-score rating-${ratingBand(rating)}`}><strong>{rating.toFixed(1)}</strong><span> / 5</span><span className="rating-band">{ratingBand(rating)}</span></span>;
  return <section className="provider-ratings" aria-label="Overall provider ratings">
    <h4>Overall ratings</h4>
    <dl>
      <div className="rating-aggregate"><dt>All platforms</dt><dd>{score(average)}<small>{availableCount} of {providers.length} providers</small></dd></div>
      {providers.map(provider=><div key={provider.platform}><dt>{provider.platform}</dt><dd>{score(provider.rating)}{provider.rating!==null&&provider.ratingBasis&&<small>{provider.ratingBasis==='recent'?'Recent average':'All-time average'}</small>}<small>{provider.rating!==null&&provider.totalReviews!==null?`${provider.totalReviews.toLocaleString()} ${provider.platform==='OpenTable'?'all-time written reviews':'reviews'}`:'No verified rating count'}</small></dd></div>)}
    </dl>
    <p>All averages the available provider ratings equally. These are provider-wide ratings, separate from the collected review sample. Each provider may use a different time window.</p>
    <p className="rating-legend"><span className="rating-high">High · 4.0–5.0</span><span className="rating-medium">Medium · 3.0–3.9</span><span className="rating-low">Low · below 3.0</span></p>
  </section>;
}
