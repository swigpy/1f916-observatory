# Round 1 verification and review

## Private exploration iteration — 12 September

The historical round-1 report below is retained. The repository now exists privately and the current change prepares a normal draft PR; consult its live check status for remote CI, rather than the historical delivery limitation.

- 28 local Node tests, GET/markup audit and offline build pass. New coverage includes independent filters, UTC boundaries, old-post preservation in Top, Hot age decay, stable ties, overlapping topics, unclassified fallback, pagination, fixed snapshot/pin cursors, duplicate and stalled-walk failure, link-only null bodies, untrusted archive titles, no-JavaScript links and responsive topic-picker reachability.
- Source verification checks each raw page hash, the exact cursor URL chain, complete-walk termination, and equality of projected fields with the corresponding raw rows. 4,985 visible posts, 50 responses, 13:53–14:04 UTC on 12 September. Earliest visible record: 5 August. Counts are not an atomic snapshot.
- 4,584 archive views, plus the Explore alias and existing pages: 4,602 HTML files. All 316,421 generated local links/assets/anchors resolve, including every filter combination and result page. Visitors receive only their requested HTML, not the multi-megabyte source index. Full static output is about 238 MB before deployment compression; this deliberate zero-JavaScript pagination tradeoff should be revisited as the archive grows.
- Browser: desktop Hot → Top → All time → Culture & play → page 2 preserved independent selections. Top / All time exposed post #1916 from 24 August with 106 votes at capture. Mobile topic expansion and selection worked. At 390 × 844 CSS pixels the document's 375px available width equaled scroll width; 200% text in a 640px frame measured 625px available/scroll width. These are layout tests, not physical-device tests.
- The first dossier now introduces citizens and test design in everyday language. Original claims remain attributed and linked; the rewrite does not independently verify them. Other archive snippets remain original text, not simplified summaries.
- axe-core reports no violations for the tested Explore page (color-contrast rule excluded under jsdom, as in round 1). No physical iOS/Safari, screen-reader or newcomer comprehension study is claimed.
- Both repository and Site remain private. The public Pages workflow has an additional disabled-by-default release gate. No personal-owner attribution, analytics, new credentials, BC task, editorial schedule or 1F916 write was added.

Next: test topic quality and comprehension with a newcomer, then decide how much plain-language help can be generated and checked without creating a daily editorial obligation. Archive refresh remains explicit and reviewed.

![Explore on desktop](qa/explore-desktop.jpg)

![Explore at a mobile layout width](qa/explore-mobile.jpg)

## Historical first-round report

11 September 2026. Implementer review by OpenAI Codex for the project owner; not an independent security audit.

## Executed checks

- `npm run check`: audit, 20 Node tests, and offline static build passed.
- AST/markup audit: 16 normal page variants, one approved GET boundary, no secret-entry controls, no unsafe HTML sinks. Negative controls fail when a method or sink is made unsafe.
- Rendering tests: injected script, SVG and event-handler text stays inert in parsed HTML. Public source titles, quotes and editorial fields are escaped.
- HTTP fixtures: blocked operation/URL selectors, credential omission, redirect refusal, 404/429/503, invalid JSON/content type, streamed size cap, abort deadline.
- Transformations: source digests, source-reference scope, stable ordering, moderation handling, missing/self reply-parent cases, explicit citations and freshness markers.
- No-JavaScript and offline tests: original dossier remains present; API failure/malformed activity re-enables the check without changing the story; single-flight and one-minute throttling verified.
- axe-core: zero violations on six representative page bodies. Color contrast is disabled in jsdom, which lacks a layout engine. Main palette pairs were separately calculated: body 14.63:1, muted on white 6.04:1, rust on white 5.76:1, editorial badge 7.40:1, navigation 10.89:1. This is not an exhaustive WCAG certification.
- Generated output: 17 HTML files; 300 local links/assets/anchors checked, no missing targets. Source ZIP integrity and relative member paths validated.
- Initial HTML, CSS, three JS modules and favicon total 44,032 bytes; gzip estimate 13,576 bytes before HTTP overhead. No remote font or image dependency and zero initial 1F916 requests. This is an artifact-size check, not a network performance benchmark.

## Browser inspection

Chrome, supervised local preview:

- Desktop: homepage hierarchy, three story cards, dossier, exact source disclosure, original/reader URLs, and citizen-context navigation inspected.
- Mobile: 390 × 844 CSS-pixel iframe; home → dossier → gnomon navigation exercised. Homepage and citizen reading inspected visually. The content width of the initial mobile page matched its available width (375 CSS pixels after scrollbar), with no horizontal overflow.
- Text enlargement: root text size 32px (200%) in a 640px iframe. Content width 625px matched the available width after scrollbar. Header wrapped and text remained legible.
- Optional activity check contacted the real public source and displayed that newer board activity exists while preserving this edition.
- Available console errors during review were from the browser extension, not the application. The browser-control transport was intermittently unreliable during screenshot capture; the saved desktop screenshot is included below.

These are browser layout checks, not physical-device emulation or a Safari/iOS test. No human one-minute comprehension study or screen-reader session has run yet.

![Desktop home](qa/desktop.jpg)

## Review outcomes

- Improved small text sizes and mobile heading scale after visual review.
- Fixed nested complementary landmarks flagged by axe.
- Kept story status in the editorial layer, since the API does not supply that narrative status.
- Prioritized authored story posts in citizen context; added escaped reply extracts instead of relying only on opaque comment IDs.
- Verified that a live activity result cannot rewrite a saved editorial claim.
- Raw capture digests are integrity evidence, not source authentication. Profile response hashes refer to deliberately unretained full responses; only the documented projection is committed.
- No BC repository, publisher credential, 1F916 mutation, bounty submission or payout operation is part of this change.

## Delivery limits

The GitHub workflows are prepared but have not run. The intended public GitHub repository is not yet accessible and the connected toolset cannot create one. Therefore no GitHub PR, merge, remote CI result or GitHub Pages deployment is claimed. The source branch, downloadable source and separate static preview provide the review artifact while that one-time repository prerequisite is resolved.

Round 2 should first run the one-minute newcomer test, add a cultural/playful story, and establish an edition update/diff process with evidence review. Avoid expanding into a general dashboard before the narrative concept is validated.
