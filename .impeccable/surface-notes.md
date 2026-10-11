# Restaurant discovery

Mode: operate. Approved concept: `.impeccable/mocks/city-catalog.png`. Concept seed: `37f8d1f1`; user selected city catalog in place of the seeded direction.

The visitor searches the NYC catalog, filters by cuisine, borough or health grade, and opens a restaurant below its row to compare review platforms and star tiers. The restaurant identity stays visible while review tools change.

| Approved ingredient | Implementation |
| --- | --- |
| Yellow full-width navigation, navy wordmark and fork | Semantic navigation; Lucide fork icon; Barlow heavy type |
| Large heavy heading above one search/filter row | Semantic text and native accessible inputs |
| Compact three-column catalog, two rows visible | Responsive CSS grid, two columns on tablets, one on phones |
| Food photographs beside names, addresses, grade cards | Local cuisine stock photos with an explicit illustrative label; actual restaurant photos are not available |
| Letter grade placard | Semantic text with A blue, B green, C orange; user explicitly corrected the all-blue mockup |
| Saved bookmarks | Buttons with pressed state; local browser persistence |
| Full-width selected restaurant panel below row | Inline expanded region, close control, detail/inspection/review states |
| Review tabs and star filters | Actual collected sample only; empty/setup/error states until keys and collection are available |
| Yellow selected states | Borders and control fills, keyboard focus remains blue |
| Decorative skyline and slogans | Omitted because they add invented positioning; preserve visual hierarchy through the wordmark and heading |

Do not copy the mockup's fictional restaurant facts, review counts, or quotes. Do not present stock images as photos from a restaurant. The API has a real dated snapshot and on-demand inspection detail.
