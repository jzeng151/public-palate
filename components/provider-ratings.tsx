import type { Analysis } from '@/lib/review-model';
import { providerRatings } from '@/lib/review-ratings';

export function ProviderRatings({platforms}:{platforms:Analysis['platforms']}){
  const {providers,average,availableCount}=providerRatings(platforms);
  const score=(rating:number|null)=>rating===null?<span className="rating-unavailable">Unavailable</span>:<><strong>{rating.toFixed(1)}</strong><span> / 5</span></>;
  return <section className="provider-ratings" aria-label="Overall provider ratings">
    <h4>Overall ratings</h4>
    <dl>
      <div className="rating-aggregate"><dt>All platforms</dt><dd>{score(average)}<small>{availableCount} of {providers.length} providers</small></dd></div>
      {providers.map(provider=><div key={provider.platform}><dt>{provider.platform}</dt><dd>{score(provider.rating)}<small>{provider.rating!==null&&provider.totalReviews!==null?`${provider.totalReviews.toLocaleString()} reviews`:'No verified rating count'}</small></dd></div>)}
    </dl>
    <p>All averages the available provider ratings equally. These are provider-wide ratings, separate from the collected review sample.</p>
  </section>;
}
