# Final verification — 13 September 2026

An implementer check by OpenAI Codex, requested before the owner's final submission approval. This is not an independent security audit or evidence of a registered submission.

## Public release checked

- The Site homepage and GitHub repository returned HTTP 200 without authentication. GitHub reports the repository as public; Sites reports public version 5.
- GitHub main `ca974689753305a2518920fae8a2fc2f1898ca60` has tree `713027d6d0f3374f15d5b0b03852034b7b1e404d`, identical to the released local source. Its push-triggered [CI run](https://github.com/swigpy/1f916-observatory/actions/runs/34746829019) succeeded.
- Anonymous GETs returned HTTP 200 for Explore, method, all three dossiers, a citizen page, `404.html` and the source ZIP. This checks the explicit 404 document, not the HTTP status of an unknown route. Generic Python requests received HTTP 403; the identified release-check client received the pages. No authentication or access-bypass token was used.
- The downloaded ZIP has 114 entries, all byte-identical to files in the released source commit `b0f6afc1864da0cf9258215cdd13ae60052c4f79`. Its SHA-256 is `368488fdf60c3f1153cf4352e1e3559e5375cd44dd08fe38922675c71927d363`. This identifies the checked version-5 download, not any later release.
- The targeted ZIP scan found no Git history, owner's personal name, Apple relay email address, private-key marker or GitHub token pattern. This is a bounded scan, not a claim that arbitrary secrets can be detected perfectly.
- The hosting layer added a Cloudflare challenge script to the inspected HTML. Public HTML therefore differs from the generated HTML. The application does not add that script; the generated CSP does not allow inline scripts. The source ZIP is unchanged by that hosting behavior.

## Correction from the extra check

The fresh npm audit flagged Vite 8.0.0, including the upstream [development-server file-read advisory](https://github.com/vitejs/vite/security/advisories/GHSA-p9ff-h696-f583). Vite only serves the local preview; it is not in the static production runtime. This change pins Vite 8.3.0, updates its lockfile and adds `npm audit --audit-level=high` to CI. The corrected source must be merged and its regenerated source ZIP deployed before calling this correction publicly released.

With the correction, `npm audit --audit-level=low` reports zero known vulnerabilities. `npm run check` passes the GET/markup audit, all 37 tests, the offline build and 164,861 local link/asset/anchor checks across 4,602 HTML files. There are 4,584 Explore views. The archive remains close to the hosting size ceiling; this dependency correction does not solve its scaling limit.

## Browser inspection

Inspected the unchanged UI in Chrome through a local preview using the corrected dependency: desktop homepage, dossier, source disclosure and citizen context. At 390 CSS pixels, checked Explore's visible topic caveat, changed Hot to Top and then All time, and opened a captured preview with Enter. The example changed from recent week posts to older highly voted posts. A dossier citation opened its exact source disclosure.

Current screenshots: [desktop](qa/final-home.jpg), [mobile layout](qa/final-mobile.jpg). The mobile view is a real narrow iframe, not physical-device emulation. No Safari/iOS, screenreader or human comprehension study is claimed. Existing automated tests cover offline/malformed responses and accessibility basics; extension-only browser log errors are outside the application.

## Submission readiness

The public listing remains unexpired, with expiry 16 September 2026 at 23:59 UTC. Its complete 31-submission response contained no submission from `bounded-curiosity`. Binding 285 still names `bounded-curiosity`, role `worker`, listing-23, the expected Base asset and amount, and expires 13 October 2026 at 05:23:47 UTC. The bound public key is listed active with self-declared custody `self`. The asset matches the canonical official record. These checks do not establish an award or payment.

No submission, announcement, key, wallet or binding mutation was made. Recheck the listing for duplicates immediately before the separately authorized submission. The exact proposed submission and thread text are in [submission.md](submission.md).
