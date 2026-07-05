# Task: WO-9b Combined Proposals/Suggestions

**Task ID**: UI-9b
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, fixes applied, verified both platforms, pushed 2026-07-05)
**Priority**: Medium
**Branch**: ui/p12-proposals-combined (stacked on ui/p11-tab-v2, fork 4HM3DMD); review fixes on ui/p13-browser-landing (5fb33ad52)
**Spec**: Tab Shell v2 plan + doc 144 D18 ("Proposals/Suggestions combined, Proposals primary"). Local-only file.

## What changed
- crproposalvoting module imports UiComponentsModule.
- proposal-list + suggestion-list pages: ui-chip-row segment header
  [Proposals | Suggestions] under the titlebar; onSegmentChange clears any active
  search filter (stale-state fix, finding 10), clearIntermediateRoutes(both list
  routes) so back returns to the opener (no ping-pong), navigateTo sibling with
  { animated: false } (finding 9 mitigation — no page-slide on toggle).
- Titles set once in init (proposals/suggestions keys); post-fetch setTitle calls
  removed; search-failure catch now restores the title (findings 3/4 fix).
- Search, pagination, refresher, detail flows untouched.

## Known accepted behavior
Ionic StackController recreates the dropped sibling on re-toggle (refetch of first
10 rows) — acceptable v1; full restyle folds into WO-20b.

## Verification
iOS + Android: chip switch both directions with live data; back from either segment
returns to hub; titles stable.
