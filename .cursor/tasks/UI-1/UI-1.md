# Task: WO-1 Theme token system (dark+orange)

**Task ID**: UI-1
**Created**: 2026-07-05
**Status**: Review (implementation + review + BOTH-platform verification complete 2026-07-05)
**Priority**: High
**Branch**: ui/p1-tokens (fork 4HM3DMD, 5 commits: 0a9a45c08 tokens, 371f81542 chrome,
6ff91da49 review fixes, 8929d4735 dark/light toggle, 2b3d1b335 statusbar 4.0.0 Android-15 fix)
**Spec**: doc 144 Part II + WO-1. This file is local-only; never committed to the public repo.

## Description
Whole-app retheme via the token layer: two official themes (black default, white),
semantic CSS vars, chrome coherence (status bar, toasts, alerts, buttons, WebView underlay).

## Done so far
- Implemented + built + verified dark on the iPhone 17 simulator (screenshots in
  docs/overhaul-after/). Theme picker shows exactly Black/White; upgrade-install kept
  the signed-in user's saved theme.
- 8-angle code review executed (7/8 angles returned; angle B removed-behavior pending).
  33 candidate findings, deduped below into the fix plan.

## Review fix plan (deduped; apply in this order)

1. **Constants module** `src/app/services/theming/tokens.ts` (new): ACCENT `#F6921A`,
   ACCENT_INK `#1A1208`, TEXT_ON_DARK `#F5F5F7`, TEXT_ON_LIGHT `#111114`,
   SUCCESS_DARK/LIGHT `#2BC76A`/`#178A4C`, DANGER_DARK/LIGHT `#FF6B6B`/`#DF3F44`,
   ALPHA_SECONDARY_DARK `8C`, ALPHA_SECONDARY_LIGHT `99`, ALPHA_TERTIARY `61`,
   DEFAULT_THEME_KEY `black`, SIGNED_OUT_THEME_KEY `white`, STD_TOAST_CLASS.
   themes.ts, the service, and the titlebar import from here (kills ~14 duplicate literals;
   CLAUDE.md constants rule).
2. **ThemeVariant gains optional `successColor`/`dangerColor`** (theme.ts); service uses
   `variant.successColor || (usesDarkMode ? SUCCESS_DARK : SUCCESS_LIGHT)` — same pattern
   as textColor. Accent derives: `variant.buttonBackgroundColor || ACCENT`,
   ink: `variant.buttonTextColor || ACCENT_INK` (no second literal, no drift).
3. **Native theming centralized in applyThemeConfig** (next to passwordManager.setDarkMode,
   the established home): inject StatusBar; set backgroundColorByHexString with a
   `/^#[0-9a-fA-F]{6}$/` guard, **pair the icon style** (styleLightContent when
   usesDarkMode, styleDefault otherwise — fixes invisible white-on-white icons on the
   white theme, the review's hardest bug), and set `document.documentElement.style.backgroundColor`
   so overscroll matches the theme at runtime (config.xml constant only covers pre-bootstrap;
   fixes the inverted dark-flash for light users). **Remove the app.component subscription
   entirely** (supersedes the unsubscribed-subscription finding); keep only
   `overlaysWebView(false)` there.
4. **Migration robustness**: in fetchThemeFromPreferences, apply the theme FIRST, then
   persist the migrated theme key and corrected variant best-effort in try/catch (a storage
   write failure must never break sign-in — currently it would). Variant correction now
   persists too (was read-time-only patch).
5. **Signed-out default stays `white` for now** (SIGNED_OUT_THEME_KEY): angle C showed
   didsessions/onboarding screens hardcode light surfaces (e.g. scan.page.scss
   `--background: #f8f8ff`) — a dark pre-sign-in default makes text unreadable there.
   Signed-in fresh default remains `black` (prefs). The signed-out flip to dark happens in
   WO-17 when those screens are rebuilt. Logged as an explicit deferred item in doc 144.
6. **Toast helper**: private `createToast()` with shared base options (mode/cssClass/position)
   so the 3 methods stop triplicating; also add STD_TOAST_CLASS to the 2 direct toast sites
   outside the service (crcouncilvoting candidates.page.ts:176, crcouncil.service.ts:407)
   so all toasts match.
7. **`:root` defaults in global.scss** for all six semantic tokens (dark-default values);
   call sites use bare `var()` — ends the three-different-reds fallback drift and covers
   first-paint before the service runs.
8. **Revert `.secondary-text` to the opacity approach** (font-weight 400, opacity 0.8, no
   color property): the class is used in 24 templates where the color version loses
   cascade fights and stops dimming children/icons. The color-token version migrates
   per-screen during Phase 4 rebuilds.
9. **Collapse the milestone twin classes** into one comma-joined rule.
10. **Linking comments** both ways between config.xml BackgroundColor and themes.ts.
11. **defaultThemeConfig** uses the named key constants with role-based locals.

12. **(angle B) Inverse-pairing consumers fixed**: contacts action icons (friends +
    friend-details scss) and ion-toggle handle paired `--essentials-button-background-color`
    with the page background for contrast by construction; now they pair with
    `--essentials-button-text-color` (orange buttons broke the old trick).
13. **(angle B) ion-button primary matches ebutton**: the .ion-color-primary remap in
    global.scss now maps to the button tokens, so both button kinds render the accent.

Skipped, with reason: restoring the deleted commented-out "yellow" theme block (deleting
it is the point of theme retirement).

Deferred (logged, not WO-1): ~25 files hardcode the OLD dark surface #212021 which now
sits slightly off-palette next to #161619/#0B0B0D. Cosmetic shade drift, not unreadable;
migrates per-screen in the Phase 4/6 sweeps (triage rule). Also: --ion-color-primary
CSS var (not the class remap) still resolves to mainTextColor; audit its non-button
consumers during Phase 6.

## Verification (after fixes)
- Rebuild iOS sim; sweep home/wallet-home/settings/network-chooser/toast/alert in
  black+white themes; confirm status-bar ICONS visible on white theme. ✅ DONE
- Android emulator: ✅ DONE with findings (below).
- Confirm CR-council toast styled; lint touched files. ✅
- Fold in angle B (removed-behavior) findings when it returns; re-run a single verifier
  pass over the fixes themselves. ✅ (fixes 12–13)

## Android verification findings (2026-07-05)
1. **False alarm**: `adb screencap` shows the app pure black on the API-36 emulator — a
   webview GPU readback artifact (a11y tree full, user-confirmed correct on screen,
   Settings/splash capture fine, survives reboot). Use
   `adb emu screenrecord screenshot <abs host dir>` for real pixels. Documented in
   BUILD-NOTES.md.
2. **Real WO-1 bug found & fixed**: status-bar icon style calls were silent no-ops on
   Android (white icons on the white theme — same bug class as the iOS review catch).
   Cause: cordova-plugin-statusbar 2.4.3 uses legacy `setSystemUiVisibility` flags that
   targetSdk 35 ignores. Fix: upgrade plugin to 4.0.0 (`WindowInsetsControllerCompat`) +
   `<preference name="StatusBarOverlaysWebView" value="false" />` in config.xml (4.x
   defaults to true → webview drew under the status bar, clipping the titlebar). The
   repo's before_plugin_install statusbar patch (iOS resize delay) applies cleanly to
   4.0.0. package.json commits with ONLY the statusbar bump (android artifact line stays
   uncommitted).
3. Signed-in upgrade path kept the user's saved white theme on Android (matches iOS
   upgrade behavior). Signed-out fresh-boot white didsessions verified on the pre-WO-1
   build; the emulator now has a user identity, so fresh-boot re-check deferred to the
   next data-free device (signed-out theme values unchanged by WO-1).
4. iOS must be REBUILT + status bar re-verified after the plugin swap (plugin affects
   both platforms).

## Acceptance criteria
Doc 144 WO-1 acceptance + all 11 fixes verified + no finding left unaddressed or
un-dispositioned.
