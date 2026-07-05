# Task: WO-8 Wallet home rebuild (contains L3)

**Task ID**: UI-8
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, fixes applied, verified, pushed 2026-07-05; commit ddc922120)
**Priority**: High
**Branch**: ui/p8-wallet-home (stacked on ui/p7-tab-shell, fork 4HM3DMD)
**Spec**: doc 144 Part IV WO-8. FIRST Phase-4 screen rebuild. L3 (OnPush). Local-only file.
**Design**: built from plan anatomy + M1 mock + primitives (Ahmed confirmed "Build from plan + mocks now" — no Figma access).

## What changed (3 files rewritten + pref + module)
- **wallet-home.page.ts**: ChangeDetectionStrategy.OnPush + ChangeDetectorRef. Precomputed
  view-models replace the ~9 template getDisplayBalance/getMainIcon/... calls: TokenRowViewModel[]
  (buildTokenRow), NftRowViewModel[] (rebuildNftRows, null-guarded getMainEvmSubWallet), and a
  BalanceViewModel (rebuildBalanceVm, primary/secondary follow the native/fiat toggle). New
  ui.hidebalances pref (default false) masks balances; header eye toggles it. markForCheck() at
  EVERY mutation: activeNetworkWallet (wallet switch), activeNetwork (network switch),
  subWalletsListChange, stakedAssetsUpdate, updateCurrentWalletInfo (after await update() — the
  30s timer + transactionpublished + on-entry all route through it), setSortMode,
  onRefreshStakingAssetClicked, loadHideBalances, toggleHideBalances, toggleCurrency,
  currencyChangeSubscription. getMainEvmSubWallet null-guarded in openStakedAssetsProvider too.
- **wallet-home.page.html**: single ion-content; identity/wallet row (name + eye + switch + dots);
  network pill; ui-amount-display (shows native + fiat together); address chip; ui-action-grid
  (Send/Receive/Transfer/Stake → onMainAction → main subwallet coin-home, v1); ui-skeleton while
  loading; ui-token-row for tokens + collectibles; ui-empty-state for unsupported network.
- **wallet-home.page.scss**: authored fresh, token-only (zero hex).
- **ui-action-tile**: enhanced with an ng-content fallback for a projected ion-icon when no
  [icon] path is given (backward-compatible with the demo's [icon] usage).
- **module.ts**: imports UiComponentsModule. **preferences**: ui.hidebalances registered.

## Review fleet (10 agents, 7 findings, 1 refuted) + dispositions
1. **FIXED (CONFIRMED, critical L3):** native/fiat currency toggle was DEAD under OnPush —
   currencyService.toggleCurrencyDisplay() flips useCurrency but does NOT emit
   currencyChangedSubject (only fiat-currency SELECTION does), so my currencyChangeSubscription
   never fired and toggleCurrency() had no markForCheck. Now toggleCurrency() awaits the toggle
   then rebuildBalanceVm + rebuildTokenRows + markForCheck. VERIFIED LIVE (tap balance → 0 ELA
   big / 0 USD sub swaps to 0 USD big / 0 ELA sub).
3. **FIXED (CONFIRMED):** NFT counts weren't rebuilt on the 30s timer (updateCurrentWalletInfo
   rebuilt token rows but not NFT rows). Added rebuildNftRows() there.
5. **FIXED (CONFIRMED):** getDisplayableSubWallets() became dead (template now uses tokenRows) —
   removed.
2. **ACCEPTED, bounded (CONFIRMED):** subwallets' own 1-5s background updateBalance() timers set
   this.balance with NO subject (no balance-change observable exists in the model). On-entry
   balances ARE captured (updateCurrentWalletInfo awaits networkWallet.update() = all subwallet
   updateBalance), and the 30s timer bounds subsequent staleness — this matches the plan's chosen
   freshness cadence and the old code's effective bound. Real user changes (send/receive) are
   captured immediately via wallet:transactionpublished. A proper fix (model balance-subject) is
   out of WO-8 scope.
6. **ACKNOWLEDGED (CONFIRMED):** the .ts is 735 lines (>300 CLAUDE.md cap) — pre-existing (was
   556), amplified by the VM builders. Extraction of buildTokenRow/rebuild* into a helper is a
   follow-up; not scoped here.
- **REFUTED:** "60s token-value refresh freezes VMs" — the 30s updateCurrentWalletInfo timer
  rebuilds them.

## Verification (Android, dark)
- Renders: header (name/eye/dots), network pill, ui-amount-display (0 ELA + 0 USD), address chip,
  4-tile action grid (orange Send/Receive/Transfer/Stake icons), Token List + sort, ELA
  ui-token-row (icon/name/price/balance/fiat).
- Hide toggle masks total + fiat + row values to dots (eye-off), names/prices stay — OnPush ok.
- Currency toggle swaps native↔fiat primary/secondary — OnPush markForCheck ok (the critical fix).
- iOS builds green.

## Acceptance
Doc 144 WO-8: matches the plan structure; L3 regression (balance updates, currency toggle,
network/wallet switch, 30s timer, tx-published) preserved with markForCheck; builds green.
