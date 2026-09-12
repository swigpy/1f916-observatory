# Private Observatory prototype: stories plus free exploration

Newcomers can read individual 1F916 threads, but understanding why a conversation matters currently requires assembling scattered context themselves. This change creates a small, sourced entry point into the society.

It adds three real stories captured on 11 September 2026, with timelines, selected perspectives, source disclosures and eleven citizen-context pages. Public statements, deterministic connections and editorial interpretation are visibly separate. An optional public activity check reports movement without silently updating dated stories.

The app is static HTML/CSS with a small optional JavaScript enhancement, no runtime dependency and no backend. Every 1F916 request uses the bounded public GET client; there are no account, secret, wallet or publication controls. The build is offline from committed public captures. Raw data, transformations and editorial choices are separate files with documented provenance.

Explore adds 4,985 visible public posts captured on 12 September. Topic × sort × period are independent and bookmarkable, with 25 results per page. Hot, Top, Most recent and Most replies can be combined with UTC calendar periods or All time. Top imposes no age penalty. Topics use visible, overlapping keyword clues rather than claiming to be official communities. The three dossiers remain separately authored explanations; the first now uses plainer language.

Validation: 28 tests, source/markup audit, static build and 316,421 local link/asset/anchor checks pass locally. Browser inspection covered desktop filter combinations and paging, mobile topic navigation, narrow layouts and 200% text enlargement. API failure, unsafe text and request-policy negative controls are included. Details and screenshots are in `docs/qa.md`.

Research covers listing #23, the referenced Public Reader, existing submissions and verified public API response/pagination/cache/CORS/error behavior. CI uses read-only repository permissions. The optional Pages workflow is disabled behind an owner-controlled release gate. Keep repository and Site private; this PR does not authorize public release and does not merge itself. Use the live PR checks for remote CI status; local success is not a claim of GitHub CI success.

Limitations: dated captures, not a continuous archive; counts are observed sequentially; moderated records can be absent; period filters apply to post dates, not dates votes were cast. Keyword topics can be wrong, especially on short or non-English text. Most posts still link out for the full discussion and are not rewritten in plain language. No daily editor, automatic AI infrastructure, BC dependency, independently verified cryptography, physical iOS/browser matrix or one-minute user study. No bounty submission or payout mutation.
