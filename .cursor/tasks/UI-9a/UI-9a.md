# Task: WO-9a Elastos hub page

**Task ID**: UI-9a
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, fixes applied, verified both platforms, pushed 2026-07-05)
**Priority**: High
**Branch**: ui/p10-elastos-hub (stacked on ui/p9-remove-mainchainpolls, fork 4HM3DMD); review fixes on ui/p13-browser-landing (5fb33ad52)
**Spec**: Tab Shell v2 plan (approved 2026-07-05) + doc 144 D18. Local-only file.

## Description
Full-page Elastos hub at /launcher/elastos, the landing page of the tab bar's
center button. Two card sections: "Elastos Blockchain" (ELA Staking, BPoS
Voting, Statistics) and "Elastos DAO" (Identity, Proposals, Elastos Council).

## What changed
- NEW lazy child module src/app/launcher/pages/elastos-hub/ (module, page ts/html/scss);
  route added in launcher/routing.ts. AuthGuard inherited.
- Rows are ui-token-row with new optional `chevron` input (added to the primitive,
  non-breaking). Icons reuse /assets/launcher/apps/app-icons/*.
- Launch paths (wallet context REQUIRED, raw navigation throws):
  Staking → StakingInitService.start(); Voting → DPoS2InitService.start();
  Statistics → voteService.selectWalletAndNavTo(App.DPOS2, '/dpos2/menu/stats');
  Identity → navigateTo(/identity/myprofile/home); Proposals →
  navigateTo(/crproposalvoting/proposals/all); Council → CRCouncilVotingInitService.startCouncil().
- `launching` latch against double-taps (finally-reset; known ~300ms window during
  transitions — accepted v1 risk, review finding 11).
- i18n: launcher.hub-section-blockchain / hub-section-dao / hub-statistics-description
  in en/fr/zh/it (it.ts CRLF-preserved).

## Review findings fixed (workflow wf_abdfc3a1, 12 kept of 15)
- Statistics dead-end: stats.page.ts now calls dpos2Service.init() on enter
  (needFetchData-guarded, idempotent) so a direct hub entry populates _nodes
  instead of skeleton-forever. Verified live: real network stats render.
- Hub back semantics: see UI-7b record.

## Verification
Both simulators: all 6 rows launch (iOS screenshots in session); Statistics lands
on dpos2 stats tab with data; back returns to hub; hub → back → launcher home.
Android: hub renders identically, rows work.
