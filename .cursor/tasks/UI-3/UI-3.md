# Task: WO-3 Retire legacy DPoS v1 voting module

**Task ID**: UI-3
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, verified both platforms, pushed 2026-07-05; commit f40375f04)
**Priority**: High
**Branch**: ui/p3-retire-dposvoting (stacked on ui/p2-remove-easybridge, fork 4HM3DMD)
**Spec**: doc 144 Part IV WO-3. Local-only file, never committed.

## Description
Delete voting/dposvoting/ (41 files, legacy DPoS v1 voting UI) while keeping dpos2 (BPoS),
staking, dposregistration and crcouncilvoting fully working. nodes.service.ts (+ its 3
model files) relocates to dposregistration, its only remaining consumer.

## Recon (agent-verified 2026-07-05, zero drift from plan)
- nodes.service exports DPoSRegistrationInfo (used by registration/unregistration pages);
  imports model/history.model (Vote), model/nodes.model (DPosNode), model/stats.model —
  those 3 files are the ENTIRE model dir and have zero other importers → move all with it.
- Move verbatim, no trim: fetchNodes() (needed by unregistration) calls getNodeIcon().
- dposregistration/root.scss (ALSO imported by crcouncilvoting register-update +
  registration-terms and dpos2/registration) imports dposvoting/root.scss; no consumer
  uses the v1-only classes (.node-list/.node-slides/.inactive/.loading-list); only the
  empty `<div class="header">` band relies on it (background/width from v1 file, box
  overridden locally) → import the base voting/root.scss instead + fold background/width
  into the local .header.
- Dead DI (constructor-only): cyber-republic.widget.ts:9,27; intentreceiver.service.ts:17,45.
- elastos-voting.widget.ts: delete the v1 branch (lines 66-76) + import + DI; v2 branch
  identical (its dpos2 entry already uses launcher.app-dpos2-* keys).
- notifications.page.ts: DROP case App.DPOS_VOTING (v1 module can no longer emit
  notifications; fall-through to default log) + import + DI.
- global.nav.service.ts:88: default route '/dposvoting/menu/vote' → '/dpos2/menu/list'
  (all current App.DPOS_VOTING users pass explicit routes or are string-tag only; this
  covers orphaned callers).
- KEEP: App.DPOS_VOTING enum member (string tag in appmanager/vote/stake services),
  translations/strings/dposvoting/ namespace (dpos2 uses 220+ keys), src/assets/dposvoting/
  (dpos2 stats page 13 imgs + crcouncilvoting), app-dpos2-* and app-dpos-registration-*
  launcher keys.
- DROP: launcher 'app-dpos-voting' + 'app-dpos-description' keys ×4 langs (lines 64-65;
  it.ts is CRLF — newline-preserving edit).

## Implementation plan
- [x] git mv nodes.service.ts + model/{history,nodes,stats}.model.ts → dposregistration/
- [x] Fix moved imports (../model/...) + registration/unregistration import paths
- [x] dposregistration/root.scss: base import swap + .header background/width fold-in
- [x] Dead DI removals (cyber-republic, intentreceiver)
- [x] elastos-voting.widget v1 branch + DI removal
- [x] notifications.page.ts case drop + DI removal
- [x] global.nav.service.ts route swap
- [x] app-routing.module.ts:17 + app.module.ts:36,291 removals
- [x] launcher translation keys ×4 (CRLF-safe for it.ts)
- [x] Delete src/app/voting/dposvoting/
- [x] grep: no dposvoting imports left outside i18n/assets refs
- [x] Builds green; review fleet; both-platform smoke (staking + BPoS voting + dpos
      registration screens open; launcher governance panel healthy)
- [x] Commit, push fork

## Acceptance criteria
Doc 144 WO-3: dpos2/staking/registration screens open; build green. Est −40 files.

## Review findings (workflow fleet, 14 agents; 10 candidates, 6 refuted) + dispositions
1. **FIXED (PLAUSIBLE)** — the deleted v1 vote page was the only caller of
   nodesService.init(), so nodesService.dposInfo was never assigned on any remaining
   path into the dposregistration pages (TypeError on entry). Both pages now
   fetchNodes() on entry when dposInfo is missing (registration: guard before the
   clone; unregistration: fold into the existing Pending refetch). Right-altitude fix:
   pages own their data dependency instead of relying on another page's side effect.
2. **FIXED (CONFIRMED)** — dead [class.deprecated]="app.id == 'dpos'" binding removed
   from elastos-voting.widget.html (the 'dpos' RunnableApp no longer exists).
3. **ACKNOWLEDGED, no change (PLAUSIBLE, latent parity)** — the App.DPOS_VOTING default
   route now targets '/dpos2/menu/list', which (like the OLD '/dposvoting/menu/vote'
   target) breaks if entered without VoteService.selectWalletAndNavTo state. No caller
   uses the bare default today; identical hazard existed before. Noted for WO-20a.
4. Notable refutations: the "stored v1 notification renders raw i18n key" scenarios are
   impossible (no code path ever persisted App.DPOS_VOTING notifications); the
   "dposregistration orphaned" claim was wrong in its history (v1 entry has been dead
   since 2023 — vote.service hardcodes DposStatus.DPoSV2, meaning the v1 module was
   ALREADY unreachable on mainnet, strengthening D1).

## Verification results (2026-07-05)
- Builds green post-retirement (web AOT + iOS + Android).
- Android smoke: governance panel renders with v1 "DPoS 1.0 Voting" entry GONE (only
  BPoS Voting + Mainchain Polls); BPoS Voting opens with live supernode list
  (wo3-android-bpos.png); ELA Staking opens with orange token buttons
  (wo3-android-staking.png).
- iOS smoke: boots to launcher home, dark theme, healthy.
- dposregistration: lazy chunk compiles (the moved nodes.service + models resolve);
  page entry needs a registered supernode (unreachable on a fresh emulator wallet) —
  entry-guard fix from finding 1 covers the cold path.
