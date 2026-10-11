# Public Palate

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
NYC diners discovering restaurants. The user confirmed a consumer restaurant discovery app as the first version.

## Product Purpose
Find restaurants by NYC inspection letter grade and cuisine, then understand customer reviews across platforms. Demonstrate Nimble through useful restaurant discovery and evidence-backed review analysis.

## Capabilities and Constraints
Use NYC DOHMH dataset 43nn-pn8j. Consolidate violation rows by CAMIS and preserve grade dates and inspection context. A health grade and customer star rating are separate facts.
Use Nimble to discover and extract public restaurant review pages, including Google, Yelp, and Grubhub. Summarize across platforms, by platform, and by star tier using Nimble or Gemini.
API credentials are configured locally in the ignored .env file. Missing credentials and unavailable reviews must be stated honestly; do not invent customer reviews or ratings.

## Evidence on Hand
https://www.nyc.gov/site/doh/services/restaurant-grades.page
https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/about_data
An empty project at the start of this task. No incumbent brand, photos, or customer testimonials.

## Open decisions
Public Palate is a working name inferred from the project directory. Nimble and Gemini credentials passed authenticated requests on October 11, 2026. The user requested local development only.

## Brand Commitments
The user selected concept 2, the yellow city catalog, from .impeccable/mocks/city-catalog.png. Use the official NYC color associations for health grades: A blue, B green, C orange. Pending and ungraded states use neutral gray and explicit text. Preserve the compact photographic catalog and expanded restaurant detail below the selected row.
