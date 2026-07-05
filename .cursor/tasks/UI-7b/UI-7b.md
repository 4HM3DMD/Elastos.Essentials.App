# Task: WO-7b Tab bar v2 (Elastos center + Browser tab)

**Task ID**: UI-7b
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, fixes applied, verified both platforms, pushed 2026-07-05)
**Priority**: High
**Branch**: ui/p11-tab-v2 (stacked on ui/p10-elastos-hub, fork 4HM3DMD); review fixes on ui/p13-browser-landing (5fb33ad52, 92fec412a)
**Spec**: Tab Shell v2 plan + doc 144 D18 (amends WO-7). Local-only file.

## What changed
- ui-tab-bar: tabs Home · Wallet · [Elastos logo center] · Browser · Menu. Center
  embeds assets/components/titlebar/elastos.svg inline (fill=currentColor, tints via
  --essentials-accent-ink). onElastos: clearIntermediateRoutes(['/launcher/elastos'])
  + navigateTo — the hub keeps the origin in history so titlebar arrow and Android
  hardware back are consistent (review finding 2/12 fix; other tabs keep the
  clear-history root semantics). onBrowser: clearNavigationHistory + navigateRoot
  (/dappbrowser/home). Removed onActivity/ModalController/NotificationsPage import
  (bell on launcher home remains the notifications entry).
- syncActive: ELASTOS_CONTEXT_PREFIXES (/launcher/elastos, /staking, /dpos2,
  /crproposalvoting, /crcouncilvoting, /identity) latch the center — survives bar
  remounts mid-flow (finding 6 fix).
- tab-bar-visibility.service: '/dappbrowser/' hide-prefix narrowed to
  '/dappbrowser/browser' + '/dappbrowser/menu' + '/dappbrowser/edit-favorite'
  (finding 5 fix) — browser HOME shows the bar (native webview only attaches on
  /dappbrowser/browser). ADDED '/staking/' and '/crcouncilvoting/' (their fixed
  bottom chrome — staking ion-footer, council vote button — was covered by the bar;
  found during simulator verification).

## Verification
iOS: center opens hub (latched), Browser tab lands on launchpad with bar + iOS
policy notice, staking footer fully visible, stats local tabs single-bar.
Android: dApp open → /dappbrowser/browser native webview, bar hidden; exit → home,
bar restored; keyboard open hides bar (seen with password prompt).
