# Task: WO-5 Remove lightweight/advanced wallet mode (L1)

**Task ID**: UI-5
**Created**: 2026-07-05
**Status**: Review (gate PASSED, implemented, reviewed, verified both platforms, pushed 2026-07-05; commit 6a92befc2)
**Priority**: High
**Branch**: ui/p5-remove-lightweight (stacked on ui/p4-remove-hivemanager, fork 4HM3DMD)
**Spec**: doc 144 Part IV WO-5. FIRST logic-touching change (L1). Local-only file.

## Blocking pre-step: SUPERSET GATE — PASSED
Advanced must be a strict superset of lite, else Blocked. Verdict: PASS.
- Onboarding: both paths complete the SAME operations (publish DID, sign-in, hive setup,
  wallet creation). Lite just backgrounds/defers them for a faster UX; advanced frontloads
  them as visible slides. No step, screen, credential, or backup is lite-exclusive.
- Home: advanced shows 3 panels with ALL widgets; lite showed 1 panel with a subset. No
  lite-only widget. Zero feature loss from removing lite.
- Bonus finding: vote.service hardcodes DposStatus.DPoSV2 and lite has been the signed-out
  default only — advanced was always the richer path.

## Security surface (disclosed, intended)
Un-gating packet.service.onUserSignIn exposes the external red-packet intent
(packet.web3essentials.io/p?g=) to ex-lite users — the intended, disclosed behavior
(red packets are a core feature). The intent listener body was preserved verbatim by the
brace-matched un-gate. Other un-gated services (contacts, voting, CR, news, feeds, dev
tools, credential toolbox/types, esc-bpos-nft, publication, tips) expose only UI features
behind existing permission/UI gates — no NEW external attack surface. VIII.1 #8 packet
intent test is in the soak.

## What changed (49 files, advanced becomes the only experience)
- Deleted GlobalLightweightService + the 2 didsessions lightweight-mode component dirs.
- Un-gated 15 services (14 uniform `if (!getCurrentLightweightMode()){body}` → keep body;
  hive.service was the same pattern, initially missed because BSD grep mishandles `\|` —
  caught by the AOT build + a Python residual scan; tips.service was the inverted
  early-return variant).
- Onboarding (createidentity/importdid/preparedid .ts+.html): always advanced component +
  advanced title; prepare-did.service drops the lite branch + runLightweightMode + its 4
  orphaned runXStep helpers; identity.service/global.didsessions drop the lightweightMode
  SignInOption.
- Home page: always registers left/main/right, activeScreenIndex=1, always slides; widget-
  chooser always shows Identity/Elastos + no lite filter; widgets.service drops the
  availableInLightweightMode field everywhere + always returns all widgets + advanced
  default layout only.
- Toggles removed: settings menu "Wallet Mode", didsessions settings interface-style;
  privacy page lite `*ngIf`s un-gated (rows always shown).
- suggestedapps: the 2 lite-gated dApp spreads inlined (always shown); dappbrowser home +
  url-input-assistant drop the lightweight arg/DI.
- app.component drops the lightweight init; preferences: ui.lightweight default → false,
  setLightweightMode accessor removed, key + getLightweightMode KEPT for the migration.

## Migration
WidgetsService.onUserSignIn: one-time, guarded — if the persisted `ui.lightweight` is true,
regenerate the 3 home containers to advanced defaults (saveContainerState +
generateDefaultContainerState — there is no deleteContainerState) and set ui.lightweight
false. Idempotent (runs once; after that the pref is false). Non-crashing: even without it,
an ex-lite user's saved "main" persists and left/right auto-regenerate — the migration is a
UX upgrade to the full advanced main panel.

## Deferred (noted, not done)
- i18n source keys now unused (settings.lightweight/advanced/display-mode-*, lightweight-
  mode-enabled/disabled, configure-interface-style, didsessions.create-wallet/import-wallet*)
  left in place; unused translation keys are harmless and removing across 4 langs is
  error-prone. Sweep in WO-26.

## Implementation plan
- [x] Superset gate check → PASS
- [x] Un-gate 15 services (brace-matched, bodies preserved)
- [x] Delete GlobalLightweightService + 2 component dirs
- [x] Onboarding always-advanced (ts+html+services)
- [x] Home + widget-chooser + widgets.service + widgetstate + plugin.service
- [x] Toggles removed; privacy un-gated
- [x] suggestedapps + dappbrowser callers
- [x] app.component + preferences + migration
- [x] AOT build clean (0 errors) after fixing 4 issues (preparedid async, hive un-gate,
      deleteContainerState→saveContainerState, hive import)
- [x] Full iOS + Android builds green
- [x] Review fleet (security-focused): ungate-correctness + widget-migration angles ZERO findings; 6 cleanup-only findings (unused DI/imports, dead .lightweight-container scss) ALL FIXED
- [x] Both-platform soak: ex-lite migration → 3-panel advanced home (iOS+Android), settings Wallet-Mode toggle gone + WC/startup un-gated, red-packet external intent handled (grab→packet-details), boots healthy
- [x] Commit, push fork (commit 6a92befc2)

## Acceptance criteria
Doc 144 WO-5: full onboarding soak, all tabs, send/receive/browser/red packets iOS+Android;
upgrade test from lite mode. Build green. ~40 files. Rollback window: until WO-6 opens.
