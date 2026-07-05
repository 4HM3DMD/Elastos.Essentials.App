# Task: WO-4 Remove Hive manager UI (Tier A)

**Task ID**: UI-4
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, verified both platforms, pushed 2026-07-05; commit 63f6af70a)
**Priority**: High
**Branch**: ui/p4-remove-hivemanager (stacked on ui/p3-retire-dposvoting, fork 4HM3DMD)
**Spec**: doc 144 Part IV WO-4. Local-only file, never committed.

## Description
Remove the Hive manager UI ("Tier A": the hivemanager module, the hive + hive-sync
launcher widgets, the privacy hive-sync toggle) while keeping "Tier B" fully intact:
GlobalHiveService, hive cache, authhelper, HiveDataSync, the privacy.hive.sync pref
plumbing, hive-js-sdk, and ALL avatar upload/display paths.

## Recon (agent + inline verified 2026-07-05)
- hivemanager dir = 33 files; hive + hive-sync widgets; src/assets/hivemanager/;
  translations/strings/hivemanager/. HiveManagerInitService consumers: appbackground
  (live init call), notifications (live start case), intentreceiver (dead DI),
  hive.widget (deleted).
- Widget restore is graceful: builder default case logs + returns null → restore skips
  the unknown type. Saved layouts with hive/hive-sync widgets load fine (widgets skipped).
- Tier B isolation CONFIRMED: zero imports from src/app/hivemanager/ into
  global.hive.service / identity / contacts / hive-sync avatar paths.
- App.HIVE_MANAGER enum: unlike DPOS_VOTING, NO live string-tag consumer survives → removed
  (with its appmanager getAppTitle/getAppIcon cases). The commented nav enum copy is inert.
- privacy.hive.sync default is already false; consumers are identity + contacts backup
  services (subscribe to prefs.useHiveSync). Migration needed for legacy opted-in users.

## Plan corrections (both the plan doc AND the recon agent were wrong here)
- **KEEP the hive-sync-popup-* launcher keys.** They ARE consumed — by the KEPT
  GlobalHiveService.showHiveSyncInfoPopup() (global.hive.service.ts:582-583). The recon
  agent's grep missed this. That method's only caller (the hive-sync widget) is deleted,
  so the method is now dead, but it lives in Tier-B GlobalHiveService which the plan says
  keep intact — so leave the method AND its keys. Deferred cleanup: remove
  showHiveSyncInfoPopup + hive-sync-popup keys in a future Tier-B pass.
- **Migration is guarded, not unconditional.** The recon agent proposed an unconditional
  setUseHiveSync(false) on every sign-in (wrong: writes every boot, emits stale-true
  first). Corrected: read the pref, write false ONLY if currently true, then emit false —
  idempotent, one effective write, no stale-true emit to backup subscribers.

## Implementation plan
- [x] Delete hivemanager dir, hive + hive-sync widgets, assets/hivemanager, curcol-hive-cross.svg,
      translations/strings/hivemanager
- [x] app-routing route, app.module import+entry
- [x] app.enum HIVE_MANAGER + appmanager getAppTitle/getAppIcon cases
- [x] appbackground import+DI+init call; notifications import+DI+case; intentreceiver dead DI
- [x] widgets: module.ts imports+declarations (both), widgetstate union (both), builder cases
      (both), widgets.service builtInWidgets entries + default-layout pushes (both)
- [x] privacy page: html hive block + ts member/call/3 methods
- [x] generate_translations hivemanager; launcher app-hive keys ×4 (it.ts CRLF-safe)
- [x] Migration in GlobalPreferencesService.onUserSignIn (guarded false)
- [x] KEEP: hive-sync-popup keys, showHiveSyncInfoPopup, all Tier B, hive-cross.svg +
      identity/svg/hive*.svg (used by kept identity pages), the DID 'hive' onboarding step
- [x] Builds green; review fleet; both-platform smoke (avatar display, settings privacy
      page loads without the toggle, launcher panels healthy, saved layout with hive widget
      loads gracefully)
- [x] Commit, push fork

## Acceptance criteria
Doc 144 WO-4: identity avatar displays; avatar upload works; contact avatars render;
upgrade test proves saved layouts with hive widgets restore gracefully (unknown types
skipped). Build green. Est −45 files.

## Review results (workflow fleet, 7 agents; 3 candidates, 1 refuted, 0 actionable)
- **Tier-B safety angle: ZERO findings** — confirmed GlobalHiveService has no import from
  the deleted dir, all avatar/vault paths route through Tier B, the DID 'hive' onboarding
  step is independent, and backup services degrade gracefully to no-op when sync forced off.
- **Widget-restore angle: ZERO findings** — saved layouts with hive/hive-sync widgets load
  fine (unknown type → builder default → null → skipped, no throw).
- **CONFIRMED but no-fix (acknowledged):** an old persisted 'hivemanager' notification, if
  tapped after upgrade, falls to the default switch case and no-ops (no crash). The reviewer
  notes it was almost never generated (only from commented-out BackgroundService code).
  Correct behavior — the feature is gone.
- **CONFIRMED correct:** the guarded migration is type-safe, idempotent, single-write, and
  its emitted false is consumed by identity/contacts backup subscribers
  (setSynchronizationEnabled(false)+stop()) — exactly halting invisible sync.
- **REFUTED:** the "showHiveSyncInfoPopup is dead code" flag — intentional Tier-B keep.

## Verification results (2026-07-05)
- Builds green (web AOT + iOS + Android).
- Android: Settings renders; Privacy page loads with the Hive-data-sync toggle GONE and
  everything else intact (wo4-android-privacy.png). Launcher panels healthy.
- iOS: boots to launcher, "Ahmed" identity name resolves (Tier-B identity/credential path
  working), dark theme healthy.
- Commit 63f6af70a on ui/p4-remove-hivemanager (stacked), pushed to fork.
