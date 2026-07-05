# Task: WO-2 Remove easybridge module

**Task ID**: UI-2
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, verified both platforms, pushed 2026-07-05; commit 578c8f60e)
**Priority**: High
**Branch**: ui/p2-remove-easybridge (stacked on ui/p1-tokens, fork 4HM3DMD)
**Spec**: doc 144 Part IV WO-2. Local-only file, never committed.

## Description
Delete the dead easybridge module (route already commented out on master, so the
feature is unreachable) and its sole entry point, the `onboard` intent page. The
`onboard` intent case is rewritten to answer callers with an "unsupported" error
response (pre-approved micro-edit, doc 144 I.2).

## Recon (verified 2026-07-05 on ui/p1-tokens tip)
- src/app/easybridge/ = 17 files; src/assets/easybridge/ (contracts+icons);
  translations/strings/easybridge/ → 25 files total across the three roots.
- External refs: app-routing.module.ts:26 (commented), launcher intents/onboard page
  (4 files, easybridge is its only real feature), launcher/routing.ts:11 (page route),
  intentreceiver.service.ts:70/91-106 (onboard case → navigates to the page),
  app.enum.ts:23 (EASY_BRIDGE), generate_translations.ts:24, `app-easybridge*` keys in
  launcher en/fr/it/zh, src/assets/launcher/apps/app-icons/easybridge.svg (referenced
  ONLY by the deleted page html).
- KEEP: launcher/pages/onboard (different page, WO-26 restyle); the `onboard-deeplink`
  intent page (unrelated); MULTI_SWAP enum + commented multiswap route (not in scope).

## Implementation plan
- [x] Delete src/app/easybridge/, src/assets/easybridge/, translations/strings/easybridge/
- [x] Delete src/app/launcher/pages/intents/onboard/ + routing.ts:11 route
- [x] Delete src/assets/launcher/apps/app-icons/easybridge.svg
- [x] intentreceiver.service.ts: onboard case → sendIntentResponse error "Unsupported feature",
      no navigation; drop unused imports if any become unused
- [x] app.enum.ts: remove EASY_BRIDGE
- [x] app-routing.module.ts: remove the commented easybridge line
- [x] generate_translations.ts: remove "easybridge" from the module list
- [x] Remove app-easybridge + app-easybridge-description keys ×4 langs
- [x] `git grep -i easybridge` → zero hits in tracked sources
- [x] Web build green; Android APK + iOS sim build green
- [x] Smoke: boot both platforms; fire onboard intent → unsupported response, no crash

## Acceptance criteria
Doc 144 WO-2: build + smoke; grep easybridge returns only git history. −25 files.

## Review findings (workflow fleet, 19 agents; all CONFIRMED verdicts) + dispositions
1. **FIXED** walletconnect.v1.service.ts:388-393 — stale `/onboard` special case suppressed
   the return-to-app toast on the removed premise that onboarding shows UI in Essentials.
   Special case removed; WC onboard requests now show the standard toast.
2. **FIXED** external deep-link callers foreground Essentials and then nothing happens
   (silent no-op). handleOnBoardIntent now shows a genericToast
   ('launcher.onboard-feature-unavailable', new key ×4 langs) before answering.
3. **FIXED** it.ts was rewritten wholesale (CRLF→LF churn from the scripted edit; 346-line
   diff). Restored base CRLF and re-applied as a clean 3-line diff (2 removals + toast key).
4. **FIXED** stale `src/app/easybridge` entry in tsconfig.json `exclude`.
5. **ACKNOWLEDGED, no change** — the {error:'Unsupported feature'} payload travels every
   caller's SUCCESS channel (native intent plugin has no responder-side reject path), so
   callers cannot observe it as an error. Same non-signal existed before (old code answered
   {} instantly, before onboarding). Making callers' promises reject would require
   handleEssentialsUrlIntent/WC-handler changes beyond WO-2 scope; feature is retired.
6. **OUT OF REPO** — Tests/Web/Client/client-test has a testEasyBridgeOnBoarding() button
   (separate git repo). It now gets the unsupported response + toast. Clean up whenever the
   Tests repo is next touched.
7. **PROCESS** — package.json android artifact stays out of the commit (selective staging,
   same as WO-1).

## Verification results (2026-07-05, actual)
- Web + iOS + Android builds green post-fixes.
- Android: booted to launcher (dark); onboard deep link fired twice — app foregrounds,
  answers instantly, NO navigation, and shows the accent-styled toast "This feature is
  no longer available" (captured: docs/overhaul-after/wo2-android-onboard-toast.png).
  Note: `am start -a VIEW -d <url>` WITHOUT the package opens Chrome on the emulator —
  always pass io.web3essentials.app.
- iOS: booted to launcher (dark), widget panels healthy (wo2-ios-final.png).
- git grep -i easybridge → only the explanatory comment in intentreceiver.service.ts.
- Commit 578c8f60e on ui/p2-remove-easybridge (stacked on ui/p1-tokens), pushed to fork.
