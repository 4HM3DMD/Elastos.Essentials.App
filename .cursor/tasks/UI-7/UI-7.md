# Task: WO-7 Bottom tab shell (L2)

**Task ID**: UI-7
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, fixes applied, verified, pushed 2026-07-05; commit e7fb2b98e)
**Priority**: High
**Branch**: ui/p7-tab-shell (stacked on ui/p6-ui-primitives, fork 4HM3DMD)
**Spec**: doc 144 Part IV WO-7. L2 logic-touching. Local-only file.

## Description
A global bottom tab bar mounted in the app shell (app.component), shown only on the
right routes and hidden during intents/onboarding/keyboard, behind a kill-switch pref.
Built and defaulted-on but coexists transitionally with legacy wallet-home footers
(footers removed in Phase 6).

## What changed
- **GlobalIntentService** (additive): new `hasUnansweredIntent$: BehaviorSubject<boolean>`
  set true in processNextIntentRequest (when an intent starts processing) and cleared when
  `intentsBeingProcessed` empties in sendIntentResponse + in clear(). Reflects the
  array-of-concurrent-intents correctly (parent+child chains). No silent-drop path — every
  intent ends via sendIntentResponse or clear() on signout.
- **GlobalPreferencesService**: registered `'ui.tabbar': boolean` (interface + default true).
  setPreference throws on unregistered keys, so registration is mandatory.
- **TabBarVisibilityService** (NEW, src/app/services/): combineLatest(currentUrl$ from
  router NavigationEnd, keyboardOpen$ from Keyboard plugin willShow/willHide,
  intentService.hasUnansweredIntent$, tabBarEnabled$ from the pref). Hidden when: pref off,
  not signed in, keyboard open, intent pending, or url starts with a HIDE prefix
  (/didsessions/, /scanner/, /intents/, /dappbrowser/, /identity/myprofile/, /dpos2/menu/).
  Mirrors the result onto a `has-tabbar` body class. distinctUntilChanged.
- **ui-tab-bar** (NEW component, declared in AppModule; uses ion-icon so no extra module
  deps): 5 tabs — Home (navigateHome), Wallet (navigateRoot WALLET /wallet/wallet-home),
  Apps (center raised, STUB → navigateHome; TODO WO-33 Apps hub), Activity (presents
  NotificationsPage modal, matching notificationmanager.service pattern), Menu (navigateRoot
  SETTINGS /settings/menu). Each tap clearNavigationHistory() FIRST. Active tab tracked from
  the router url. Token-only styling; raised accent center circle with a box-color ring (no
  shadow, per II.3 no-shadows-on-dark).
- **app.component**: template += `<ui-tab-bar *ngIf="tabsVisible$ | async">`; injects the
  service, calls init() after theme.init(), exposes tabsVisible$; refreshPreference() after
  navigateToFirstScreen (reads the signed-in user's kill-switch value).
- **global.scss**: `body.has-tabbar :where(ion-content){ --padding-bottom: calc(64px +
  env(safe-area-inset-bottom)) }` — :where() = zero specificity so any page that sets its
  own --padding-bottom still wins; pages without one get tab clearance. (New env() inset
  pattern; test on notch + SE.)
- **Developer Options page**: hidden "Bottom tab bar" toggle (the kill switch).

## Decisions
- Apps center button: STUB to launcher home (D5-updated → WO-33 Apps hub is Phase 7, not
  built). TODO logged in the component.
- Padding: global :where() rule only; NO per-page edits. Legacy footer coexistence accepted
  for this transitional phase (Phase 6 removes footers). ~55 files touch padding-bottom but
  most are on hidden routes or already clear 64px; the plan's per-page collision audit is
  deferred to the screen rebuilds (WO-8+) that touch those pages anyway.

## Implementation plan
- [x] Intent service hasUnansweredIntent$ (set/clear, 3 points)
- [x] ui.tabbar pref registered (interface + default)
- [x] TabBarVisibilityService (route/keyboard/intent/pref/signed-in + body class)
- [x] ui-tab-bar component (5 tabs) + AppModule declaration
- [x] app.component template + wiring + refreshPreference
- [x] global.scss :where() padding rule
- [x] Dev Options kill-switch toggle
- [x] AOT build clean
- [x] Full iOS + Android builds green
- [x] Review fleet (15 agents, 8 findings, 4 refuted). FIXED: stuck-true intent flag (self-heal on return to /launcher/home + splice(-1) guard), kill-switch flash (prefLoaded gate — bar only shows after the pref loads), modal re-entrancy guard on Activity, launcher home footer lifted above the bar. DOCUMENTED (accepted/design-blocked): Apps center latches Home (stub until WO-33 Apps hub), voting vote-page footers overlap transitionally (rebuilt WO-20a), non-reactive signedInDIDString (sign-out always routes to hidden /didsessions/).
- [x] Android soak: tab bar renders (5 tabs, raised center); Home/Wallet/Menu navigate + reset stack + active-track correctly; content padding clears (Sign Out visible); bar HIDES on /scanner (camera full-screen); launcher home footer (edit/dots/add) lifted above the bar; no tab bar during sign-in (prefLoaded gate). iOS builds green.
- [x] Commit, push fork (commit e7fb2b98e)

## Acceptance criteria
Doc 144 WO-7: soak matrix V.1-B on iOS + Android extended with dApp-browser hide/restore,
identity/dpos2 single-bar, one queued pre-sign-in deep link lands bar-less. Build green.
Rollback: revert (window until WO-8 opens). +6 files, ~5 edited.
