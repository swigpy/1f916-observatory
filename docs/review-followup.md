# Response to the supplied Claude review

The owner supplied the review text. Its reports of execution are attributed to that reviewer; we reproduced the concrete index counts, raw control characters and local checks separately. No human comprehension test has run.

## Implemented

- Public display normalization removes C0/C1 controls (retaining tabs and normalized newlines) and explicit bidi embeddings/overrides/isolates. It happens at HTML escaping and excerpt generation, not in source storage or source projection. Post #2565 retains its 117 original NULs in the evidence and renders without them. Every generated HTML file now rejects these controls.
- A title opens an existing explanatory dossier or the captured preview in a native, keyboard-operable disclosure. Original records and the external reader are separately labelled; the reader hostname and expected path are checked. This does not claim to host complete discussions.
- Homepage explains the forum and its citizen accounts. Dossiers 2 and 3 now explain the events before technical terminology. The 103-second wait is explicitly not presented as a breach of a five-minute maximum.
- Topic and period choices show counts. Topic caveats remain visible on mobile. No keyword matched replaces the ambiguous rest category. Classification rules themselves remain unchanged; 39% unmatched is a limitation to investigate, not something fixed by a new label.
- Capture labels show their date without an automatic 24-hour overdue status. Explore's page metadata uses its own capture clock. Profile pages explain why full-response hashes cannot be reproduced from the retained projection; download links explain integrity versus source authentication.
- Request budget can be raised explicitly with `--max-pages=N`, bounded to 1–1000, and resumed pages still bind the same snapshot. Default pacing, no automatic retries, candidate-only writes and no automatic publication remain. This removes the need for a code edit at 10,000 rows; it does not promise scalability.
- Empty selections offer real escape links. Both public Pages jobs explicitly require the release variable. That workflow remains disabled and has not been dispatched.
- Filter and pagination borders use #718294: 3.64:1 against the page, 3.95:1 against white and 3.43:1 against the hover background.
- Deployment exposed a real storage boundary: the host rejected the first 274.9 MiB expanded export (256 MiB maximum). Compact keyword disclosures and removal of empty attributes bring file content to 248.6 MiB without changing result sets or removing local previews. Topic selection remains in the filter controls; per-post keyword disclosures explain matching without repeating that navigation. A 252 MiB build gate now stops oversized releases before upload.

## Recommendations not adopted literally

Equal first pages under Hot do not mean equal full result sets. No valid test should require every period to change page 1. Likewise This year and All time should agree when all source dates are in the current year. The user's requested independent choices remain, with explicit counts and explanations. Most recent is not a reliable way to surface old posts either; Top with a wider period is the better instruction for that goal.

The saved capture contains **1,800** year-view pages, across all topics and sorts, whose result rows match All time; the review's 800 accounts only for the all-topic pages. These are duplicate result sets, not byte-identical HTML: active choices and navigation differ. We have not disguised that cost by silently changing filter behavior.

Low-contrast borders are a worthwhile usability improvement, but not automatically a WCAG failure for every text-labelled control. W3C explains that sufficiently identifiable controls need not have a contrasting hit-area boundary. We improved the borders anyway; this is not an exhaustive conformance claim. [W3C SC 1.4.11, Boundaries](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html#boundaries).

The `post.id <= snapshot_id` guard is retained as an explicit current integration assumption: observed captures support it, while the retained surface catalogue describes snapshot-bounded membership without fully defining the numeric relationship. A changed contract must stop capture for investigation. No speculative namespace change was observed or inferred as fact.

## Still open

- The complete static matrix is large and grows with the archive. The compacted export is still larger than the pre-review edition, with little hosting headroom. Redesign shared result rendering before increasing routine capture volume; raising the capture request budget alone cannot make the next edition deployable. Preserve useful filter choices and a readable no-JavaScript fallback when doing so.
- Topic quality, cultural coverage and short/non-English previews need evaluation. Counts make the limitation visible; they do not remove selection bias.
- Complete conversations still depend on primary sources or an optional external reader. This round does not build a second full forum reader.
- Only retained post/feed bytes are offline-reproducible. Neither internal hashes nor this review independently authenticate their original source.
- The owner can run the short protocol in `newcomer-test.md`; do that before adding more product features. No human test, Safari/iOS or screen-reader result is claimed.
