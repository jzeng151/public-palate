# Public Palate

A local NYC restaurant discovery app. Search 31,515 restaurant records by cuisine, borough, name, address, ZIP code, or health grade. Open a restaurant to see inspection history and collect public reviews with Nimble.

## Run locally

Requires Node 22.13 or later.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The restaurant catalog works without API keys. Saved places stay in this browser's local storage.

API keys are configured in `.env`. You can also use `.env.local` for local overrides, using `.env.example` as a reference. Do not add empty overrides for configured keys. Keep keys out of chat and source control.

```dotenv
NIMBLE_API_KEY=your_nimble_key
GEMINI_API_KEY=your_optional_gemini_key
GEMINI_MODEL=gemini-3.8-flash
SOCRATA_APP_TOKEN=your_optional_nyc_open_data_token
```

Restart `npm run dev` after changing keys. Nimble is required for collection regardless of the selected summary engine. Gemini is optional. Open a restaurant, select **Nimble** or **Gemini** under **Summarize with**, then choose **Read reviews**. The keys are used only by server routes.

## What works

- Search, cuisine and borough filters, official health grade filters, pagination, sorting, and saved restaurants.
- Restaurant details with the latest recorded grade and its date. Inspection history is fetched from NYC Open Data when a restaurant opens.
- Google uses Nimble’s `google_maps_search` and `google_maps_reviews` templates to retrieve 20 reviews by matched Place ID. Yelp uses Nimble search, native extraction to match its business ID, and XHR extraction of its public review feed. Browser network capture provides a fallback. Grubhub waits for its JavaScript and preserves up to 30 written reviews and their star icons from the captured HTML. Each platform’s progress appears in the detail panel.
- Nimble Web Search Agents or Gemini extracts a review sample and produces summaries across platforms, by platform, and by star tier.
- Platform and star filters, review excerpts with source links, a sample-only star distribution, refresh, and a downloadable JSON report.
- Provider-wide average ratings for Google, Yelp, and Grubhub, plus an All platforms average that weights each available provider equally. Missing or unconfirmed ratings are excluded. Review filters do not change these overall ratings.
- Collection continues when switching restaurants, closing the detail panel, or viewing inspections. Returning restores progress or the completed report. Each restaurant retains its summary engine choice, and repeated starts share the active request. Use Stop to cancel a collection.
- Explicit missing-key, collection failure, uncertain-location, and empty-sample states. No synthetic reviews are shown in the app.

## Health grades and data

| Grade | Color | Violation points |
| --- | --- | --- |
| A | Blue | 0 to 13 |
| B | Green | 14 to 27 |
| C | Orange | 28 or more |
| Pending / ungraded | Gray, with a text label | No letter grade shown |

These color associations follow [NYC Health's official grading guide](https://www.nyc.gov/assets/doh/downloads/pdf/rii/inspection-cycle-and-letter-grading.pdf). Colors and letter labels always appear together. Health grades and customer star ratings are separate facts.

The included [DOHMH inspection dataset](https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/about_data) snapshot was retrieved October 11, 2026. Dataset records were dated October 9, 2026. Restaurants are consolidated by CAMIS before filtering, so repeated violation rows do not become duplicate restaurants. The catalog uses the most recent recorded nonempty grade, including pending states, and preserves its issue date. An inspection score alone is never converted into a new grade. The dataset's 1900 placeholder date is omitted.

The catalog is a dated snapshot, not a live operating-status directory. A later inspection may not issue a new grade. The detail view calls out a closure when it appears in the latest inspection action.

Refresh the catalog, then restart the server:

```sh
npm run data:refresh
```

## Review collection limits

Review availability depends on what Nimble can retrieve from each public page. Login walls, dynamic content, and platform restrictions can result in partial or empty samples. Google requests one page of up to 20 reviews sorted by relevance. Yelp requests 10 reviews sorted by relevance. Grubhub retains the first 30 distinct written reviews in the rendered page. The sample is not the platform's complete review history or rating distribution.

All three collectors check the restaurant name, normalized street address, and ZIP. Name matching ignores common legal and promotional words such as “LLC,” “Famous,” and “Original”; the street address and ZIP must still match. Yelp also checks that each review belongs to the matched business ID. The server rejects reviews without a confirmed platform match, excerpts absent from the captured evidence, duplicate excerpts, and summaries citing missing reviews or the wrong platform or star tier. Review text, authors, and ratings come directly from captured responses and remain available if summarization fails. Summary meaning still depends on model interpretation and can be wrong. Source links remain available for inspection.

Grubhub normalizes search results to the restaurant ID’s `/reviews` URL, removing paths such as `/catering` that previously produced `/catering/reviews`. It uses Nimble’s `vx10` driver and waits for written review elements instead of a fixed delay. A loading page, matched page without written reviews, timeout, or provider server error gets one retry with `vx10-pro` and a longer wait. Wrong-location, country restriction, authentication, and quota errors are not retried. HTML retains per-review star icons that Markdown omits. Pages without written reviews remain unavailable after the bounded retry. See [Nimble’s rendering documentation](https://docs.nimbleway.com/nimble-sdk/web-tools/extract/features/js-rendering).

Yelp loads written reviews separately from its business page. A captured HTTP 200 page contained only “Recommended Reviews / Loading…”; rendering attempts also returned provider timeouts. The collector now reads the business identity from the initial page and requests Yelp’s public `GetBusinessReviewFeed` operation through Nimble’s `vx6` XHR mode. It sends no Yelp cookies, login credentials, or visitor identifier. The operation ID was observed in Yelp’s own request on October 11, 2026 and can change. If the fast path fails, a `vx10-pro` browser waits for written reviews and captures the current `/gql/batch` response. Browser fallback can take up to three minutes. Both paths retain individual review IDs, ratings, dates, and text, exclude owner replies, and reject loading pages. See [Nimble’s XHR and network capture documentation](https://docs.nimbleway.com/nimble-sdk/web-tools/extract/features/network-capture).

Successful reports with reviews and no analysis warning are cached in server memory for one hour. The browser retains collection progress, errors, and completed reports until the page reloads or the tab closes. Navigation within the app does not cancel a request; reloading or closing the browser loses the active client state. Refresh requests new collection. The local server allows up to three concurrent collections and ten starts per minute. Collection can incur provider charges. This local prototype has no account system or durable shared cache.

Both provider paths have isolated mocked integration tests. Nimble search, a Nimble structured-output agent run, and Gemini generation passed authenticated live requests on October 11, 2026. Blank template entries in `.env.local` were removed so the app loads the configured keys from `.env`.

Live Katz’s Delicatessen tests retrieved 20 Google reviews, 10 Yelp reviews, and 30 Grubhub reviews. Yelp’s direct review-data request completed in 1.4 seconds in one probe; a subsequent complete collector run used about 7.4 seconds of provider time across its identity and review requests, plus search. Browser capture was separately verified. Gemini returned a temporary 503 during an earlier larger analysis request; the app retries one transient failure and distinguishes provider outages from authentication errors.

A fresh local `/api/reviews` request returned all 60 reviews in about 59 seconds. Gemini analysis was unavailable after a retry, so that report contained the original reviews and an analysis warning, with no summaries.

A subsequent Famous Joe’s Pizza test at 7 Carmine Street exposed a name mismatch: Google calls it “Joe’s Pizza.” The shared name normalization fix retrieved 20 Google reviews. A full local API run also returned 10 Yelp reviews in about 19 seconds. Grubhub returned a listing for 1435 Broadway, which failed the location check; Gemini remained unavailable after a retry. React DOM tests reproduce switching away during collection and returning both before and after completion. They also verify that navigation does not issue a duplicate request.

Repeated Katz’s Grubhub requests exposed a catering-page search result. The failed `/catering/reviews` request returned a loading page. Changing only that URL to the canonical restaurant reviews page retrieved 30 reviews. Waiting for the review elements and rerunning the production collector also retrieved 30 reviews. Tests cover catering URLs, matched pages with delayed reviews, the retry limit, and continued rejection of wrong branches.

## Project structure

- `app/page.tsx`, `app/globals.css`: the approved yellow city catalog.
- `components/restaurant-detail.tsx`, `components/review-panel.tsx`: inspection and review interactions.
- `lib/review-collection.ts`: browser collection state and request ownership independent of mounted panels.
- `components/provider-ratings.tsx`, `lib/review-ratings.ts`: provider-wide ratings and their equal-weight aggregate.
- `lib/restaurant-data.ts`, `data/restaurants.json`: catalog consolidation and snapshot.
- `lib/review-pipeline.ts`, `lib/google-reviews.ts`, `lib/yelp-reviews.ts`, `lib/grubhub-reviews.ts`, `lib/review-model.ts`: Nimble collection, model analysis, evidence validation.
- `app/api/restaurants`, `app/api/reviews`: server-only APIs.
- `PRODUCT.md`, `DESIGN.md`, `.impeccable/`: product context, design rules, and approved visual reference.

Built with React, TypeScript, and Vinext's Next.js-compatible routing on Vite. ChatGPT Sites hosting is configured in `.openai/hosting.json`; hosted credentials are runtime secrets managed by Sites, separate from local `.env` files. GitHub source lives at [jzeng151/public-palate](https://github.com/jzeng151/public-palate).

```sh
npm run typecheck
npm test
npm run build
```

## Sources and assets

- [NYC restaurant grades](https://www.nyc.gov/site/doh/services/restaurant-grades.page)
- [Nimble documentation](https://docs.nimbleway.com/)
- [Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output)
- Barlow fonts from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/barlow), under the SIL Open Font License.
- Local cuisine photos from Unsplash. They are explicitly labeled illustrative, not photos of the selected restaurant. Image IDs are recorded in `public/images/CREDITS.md`.
