---
name: Public Palate
description: A yellow city catalog with official health grades and source-backed diner reviews.
colors:
  yellow: "#ffdc3d"
  yellow-deep: "#d4a900"
  ink: "#101d39"
  muted: "#59667b"
  line: "#dce1e8"
  background: "#f7f8fa"
  white: "#fff"
  blue: "#1764b5"
  green: "#327745"
  orange: "#bb5a18"
  neutral: "#616a76"
  focus: "#145bcc"
typography:
  display:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "clamp(36px, 4.6vw, 66px)"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "33px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  action:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  grade:
    fontFamily: "Arial, sans-serif"
    fontSize: "65px"
    fontWeight: 800
    lineHeight: 1.03
    letterSpacing: "-0.03em"
rounded:
  placard: "4px"
  compact: "6px"
  field: "8px"
  surface: "12px"
  chip: "20px"
  action: "24px"
spacing:
  small: "8px"
  compact: "12px"
  base: "16px"
  roomy: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "13px 20px"
  button-text:
    textColor: "{colors.ink}"
    padding: "4px 0"
  search-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "54px"
  platform-selected:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "8px 13px"
  restaurant-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  summary-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "18px"
  grade-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.placard}"
    padding: "3px 7px 5px"
---

# Design System: Public Palate

## Overview

**The yellow city catalog.**

Public Palate presents New York restaurants as a compact, photographic catalog. Taxi yellow anchors the navigation; navy Barlow lettering gives names and headings a direct, civic character. White entries sit on a cool, pale background. This is the user's approved second concept, captured in `.impeccable/mocks/city-catalog.png`.

The interface puts restaurant identity, an official health grade, and inspection dates together. Review analysis uses separate platform and star filters, with sources and collection status close at hand. Illustrative food photography supplies appetite and texture without implying that it depicts a particular restaurant.

**Key Characteristics:**
- Yellow navigation and navy typography.
- Compact photographic entries with distinct health-grade placards.
- Restaurant details expand within the catalog.
- Review summaries retain their sample and source context.

## Colors

The palette combines taxi yellow and navy with the established NYC grade color associations.

### Primary
- **Taxi Yellow** (`yellow`): masthead, selected platform, and saved state.
- **Deep Yellow** (`yellow-deep`): selected borders, active detail tabs, and review-distribution bars.

### Secondary
- **Grade Blue** (`blue`): A health grades.
- **Grade Green** (`green`): B health grades; also the small completed/data-status indicator.
- **Grade Orange** (`orange`): C health grades; also an unsuccessful collection status.
- **Focus Blue** (`focus`): keyboard focus and active search-field treatment.

### Neutral
- **Navy Ink** (`ink`): main text, icons, and primary action fills.
- **Slate Text** (`muted`): descriptive text and supporting metadata.
- **Cool Paper** (`background`): page canvas and summary surfaces.
- **White** (`white`): catalog entries, controls, and grade placards.
- **Divider Gray** (`line`): quiet boundaries between content and controls.
- **Pending Gray** (`neutral`): pending and ungraded health states.

**The Official Grade Rule.** A is blue, B is green, and C is orange. Pending and ungraded records use gray and explicit words. Keep the letter and health-grade label visible; color alone does not convey the grade.

**The Separate Ratings Rule.** Health grades and customer stars are different facts. Present them with different shapes, labels, and context.

## Typography

**Display and Body Font:** locally hosted Barlow, with Arial and sans-serif fallbacks.

**Grade Font:** Arial and sans-serif for the letterform inside a health-grade placard. Pending words return to Barlow.

Barlow moves from heavy, tightly spaced headings to quieter regular-weight descriptions. Restaurant names have compact leading and wrap when necessary. The grade letter is deliberately much larger than its supporting label.

### Hierarchy
- **Display:** main discovery heading; responsive sizing and tight tracking establish the first reading point.
- **Headline:** selected restaurant name; bold and compact, with responsive overrides.
- **Title:** restaurant-card names; supporting review headings use a nearby size and weight.
- **Body:** the global reading foundation. Review-summary paragraphs use generous leading (1.65); explanatory copy typically uses 1.5–1.6.
- **Action:** strong but restrained button labels.
- **Grade:** a placard-like letter, reduced in catalog cards and paired with an accessible descriptive label.

**The Name First Rule.** Within an entry, the restaurant name leads, followed by cuisine and location; grade and date remain directly associated with that restaurant.

Small captions in the current implementation are supporting metadata, not a minimum readable type standard. Preserve readable text when extending the system.

## Layout

The header and main content share a centered maximum width (1504px). Desktop horizontal padding is 40px, reducing to 28px below 1120px and 20px below 720px. Repeated internal spacing uses the frontmatter scale, with 16px gaps between catalog entries and rows.

The catalog uses three columns on desktop, two below 1120px, and one below 720px. The selected restaurant opens in a full-width panel immediately below its row. Its identity and review content occupy two columns on desktop and stack below 1120px. The detail photograph disappears below 720px; the name, grade, actions, and reviews remain.

Search shares a row with three filters on desktop. Below 1120px, search spans a full row above the three filters. Below 720px, borough and cuisine share a row while health grade spans its own row. The header tagline disappears below 1271px; the city label disappears below 720px. Review platform tabs can scroll; star filters can wrap. Review-summary comparison columns stack on narrow screens.

The desktop display clamp has explicit responsive overrides: 52px below 1271px, 47px below 1120px, and 42px below 720px. Card-name sizes also adjust to available column width. These are implemented behaviors; the narrow layout and complete expanded detail have not yet received visual verification in a browser.

## Elevation & Depth

The interface is flat at rest. White surfaces, cool-paper backgrounds, fine borders, and yellow selections establish hierarchy. The search field gains a narrow blue ring when focused; no ambient card-shadow system is used.

**The Border Before Shadow Rule.** Use borders and surface color to distinguish catalog entries, expanded details, and control states.

Detail expansion uses a short reveal (300ms) with the shared ease curve. Hover and loading-opacity changes are brief (150ms). Loading icons rotate continuously while work is pending. The reduced-motion media query disables animation and transitions and switches document scrolling to automatic.

## Shapes

Containers use gently rounded surface corners; fields and summary blocks use smaller corners. Food photos are cropped inside compact rounded rectangles. Grade placards keep tight, almost square corners and a thin border in the grade color. Primary actions and platform/rating selectors use pill shapes. Circle shapes are reserved for small avatars, counts, and status indicators.

## Components

### Buttons

Primary actions are navy pills with white, semibold labels, a minimum height of 44px, and optional trailing icons. Hover lightens their navy fill. Text actions are underlined and compact. Save controls use a thin outline and fill yellow when saved; icon buttons use a pale hover surface. Disabled controls reduce opacity and use a disabled cursor. Keyboard focus uses a blue outline (3px) with an offset (3px).

### Chips

Review platform selectors use pill shapes; the active platform fills yellow. Star filters use outlined pills, with a pale yellow fill and deeper yellow outline when selected. The health-grade legend uses small lettered rectangles in the corresponding grade colors and exposes its active filter through both style and pressed state.

### Cards / Containers

Restaurant entries have white surfaces, thin gray borders, and the shared surface radius. Hover strengthens the border. Selection adds a pale yellow surface and deep-yellow border. Each entry combines a numbered position, illustrative photo, name, cuisine, address, grade, and grade date. Bookmark controls sit separately in the upper-right corner.

The detail panel uses the same surface language and expands in the catalog flow. Review summaries use a cool-paper inset, followed by linked evidence and original excerpts. Inspection history uses divided expandable rows.

### Inputs / Fields

Search and native selects use white backgrounds, thin strokes, softly rounded corners, and leading icons. Search grows to fill available space and has a clear action when text is present. Its focused wrapper receives the blue border and ring; select focus uses the shared outline. Controls retain accessible labels independently of their visible placeholder or selected value.

### Navigation

The yellow masthead carries the wordmark, Explore/Saved navigation, and city context. Active navigation has a navy underline. Saved counts use small navy circles with yellow text. On narrow screens, navigation stays with the wordmark while secondary header text is removed.

### Health-Grade Placard

The signature grade component is a white, bordered rectangle with a large colored letter and the label “Health grade.” Compact and full variants share this structure. Pending and ungraded states replace the large letter with explicit neutral text. The accessible name supplies the grade and its explanation. Inspection dates remain outside the placard so the grade is never mistaken for a current customer review score.

## Do's and Don'ts

### Do:
- **Do** preserve blue A, green B, orange C, and gray pending/ungraded states.
- **Do** distinguish health grades from review stars through labels and visual form.
- **Do** label stock food images as illustrative.
- **Do** retain grade dates, review-sample qualifiers, and source links near their associated content.
- **Do** use the shared Barlow family, surface borders, and yellow selection states.
- **Do** preserve keyboard focus and reduced-motion behavior.

### Don't:
- **Don't** use a generic green-good/red-bad scale for NYC letter grades.
- **Don't** depict illustrative photos as restaurant-specific evidence.
- **Don't** show fabricated customer reviews, star ratings, or collection success.
- **Don't** treat the current smallest captions as a target for future reading text.
