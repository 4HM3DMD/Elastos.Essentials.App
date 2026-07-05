# Task: WO-9 New launcher Home

**Task ID**: UI-9
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, fixes applied, verifying both platforms, pushed 2026-07-05)
**Priority**: High
**Branch**: ui/p14-launcher-home (stacked on ui/p13-browser-landing, fork 4HM3DMD)
**Spec**: doc 144 Part IV WO-9 + Anatomy launcherHome + mock M0. Local-only file.

## Description
The launcher home page rebuilt on the UI primitives: an in-page header
(the titlebar is no longer used on this page), the active wallet balance,
quick-action tiles, the three pillar rows and a top-3 tokens preview,
with the widget canvas kept below the fold.

## What changed
- home.page.{ts,html,scss} rewritten. Header: identity pill (avatar +
  name from didService.signedIdentity) → myprofile; bell (unread dot from
  GlobalNotificationsService.notifications) → notifications modal; scan;
  settings. Balance: ui-amount-display fed from walletService.activeNetworkWallet;
  ui.hidebalances pref + eye toggle. Tiles: Send/Receive/Transfer/Stake →
  main token coin-home (v1 depth, D6). Pillars: Value → wallet-home,
  Identity → myprofile, Apps → dappbrowser home (ui-token-row, colored
  icon circles; new --essentials-pillar-identity/-apps theme tokens).
  Tokens: top 3 by fiat (getSubWallets(BALANCE)) → See all → wallet-home.
  Widget canvas: all 3 panels below the fold with the existing swipe,
  edit, add and dots footer.
- module.ts imports UiComponentsModule; +6 launcher i18n keys ×4 langs
  (home-pillar-value/-sub, home-pillar-apps/-sub, home-tokens, home-see-all,
  home-wallet-unavailable — it.ts CRLF-preserved).

## Review findings fixed (workflow wf_87720c38, 15 kept incl. dedup)
- Liveness: subscribes to the active wallet's subWalletsListChange +
  currencyChangedSubject, refreshes on wallet:transactionpublished, and
  polls networkWallet.update() every 30s (was a one-shot snapshot that
  disagreed with the active-wallet widget).
- Dead fiat guard: suppress the fiat line on NaN instead of "... USD".
- Empty state (ui-empty-state) when the active wallet has no network
  wallet on the current network (ledger/multisig/imported on unsupported
  networks) instead of a blank section.
- Hide-balances privacy flash: effectiveHide masks while the pref is
  still loading, so a masked balance never flashes visible on entry.
- Phantom masked fiat: a no-price token no longer shows a masked sub-line.
- Notifications double-open guard uses a synchronous flag.
- Footer add/edit scroll the below-the-fold canvas into view; the
  off-screen first-run swipe hint (looped invisibly) was removed.

## Accepted (documented)
- Top-3 ordering pins the native standard subwallet first (getSubWallets
  BALANCE comparator) — consistent with wallet home; a network has one
  standard subwallet so the preview is native + top 2 tokens.
- Identity pill name/avatar refresh on ionViewWillEnter (re-entry), not a
  live avatar-changed subscription — low severity for v1.

## Verification
iOS live: header, balance + eye toggle, 4-tile grid, 3 pillars, ELA
tokens row, See all → wallet-home, pillars navigate, widget canvas + swipe
below the fold. Android pending same-build verification.
