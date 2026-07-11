import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import {
  GlobalNetworksService,
  LRW_TEMPLATE,
  MAINNET_TEMPLATE,
  TESTNET_TEMPLATE
} from 'src/app/services/global.networks.service';
import { GlobalNotificationsService } from 'src/app/services/global.notifications.service';
import { GlobalPreferencesService } from 'src/app/services/global.preferences.service';
import { GlobalStartupService } from 'src/app/services/global.startup.service';
import { DIDSessionsStore } from 'src/app/services/stores/didsessions.store';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { GlobalDIDSessionsService } from 'src/app/services/global.didsessions.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { DposStatus, VoteService } from 'src/app/voting/services/vote.service';
import { StakingInitService } from 'src/app/voting/staking/services/init.service';
import { WalletCreator } from 'src/app/wallet/model/masterwallets/wallet.types';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { AnySubWallet } from 'src/app/wallet/model/networks/base/subwallets/subwallet';
import { TronSubWallet } from 'src/app/wallet/model/networks/tron/subwallets/tron.subwallet';
import { WalletUtil } from 'src/app/wallet/model/wallet.util';
import { WalletSortType } from 'src/app/wallet/model/walletaccount';
import { CoinTransferService } from 'src/app/wallet/services/cointransfer.service';
import { CurrencyService } from 'src/app/wallet/services/currency.service';
import { SwapService } from 'src/app/wallet/services/evm/swap.service';
import { PriceHistoryService } from 'src/app/wallet/services/pricehistory.service';
import { formatFiatAmount } from 'src/app/helpers/currency-format';
import { AggregatedTokenRow, ALL_CHAINS_GLYPH_LOGOS } from 'src/app/wallet/model/aggregated-token';
import { AnyNetwork } from 'src/app/wallet/model/networks/network';
import { AggregatedTokensService } from 'src/app/wallet/services/aggregated-tokens.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { WalletNetworkUIService } from 'src/app/wallet/services/network.ui.service';
import { UiService } from 'src/app/wallet/services/ui.service';
import { WalletService } from 'src/app/wallet/services/wallet.service';
import { DIDManagerService } from '../../services/didmanager.service';
import { NotificationManagerService } from '../../services/notificationmanager.service';

const HIDDEN_MASK = '••••••';
const BALANCE_REFRESH_INTERVAL_MS = 30000;
const TOKENS_PREVIEW_COUNT = 3;

/** Precomputed strings for the active wallet balance hero. */
interface HomeBalanceVm {
  /** Hero amount — the fiat total when priced, otherwise the native balance. */
  primary: string;
  /** Currency symbol (fiat hero) or native token name (native fallback hero). */
  symbol: string;
  /** Secondary line under the hero: native balance when the hero is fiat. */
  secondary: string;
}

/** Precomputed strings for one row of the tokens preview (2026 layout). */
interface HomeTokenRow {
  icon: string;
  badge: string;
  title: string;
  native: string; // left subtitle: the holding, e.g. "0 ELA"
  fiat: string; // right primary: fiat value, glyph-prefixed
  changePct: string | null; // right sub: signed 24h % change, null until enough history
  changeTone: 'up' | 'down' | 'muted';
  subWallet: AnySubWallet;
  /** Aggregate mode: the chain this row lives on (drives the badge and tap-switch). */
  network?: AnyNetwork;
  /** Aggregate mode: true until the subwallet has ever known a balance (value cell shimmers). */
  valueLoading?: boolean;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage implements OnInit, OnDestroy {
  private modal: HTMLIonModalElement = null;
  private openingNotifications = false;

  private walletServiceSub: Subscription = null;
  private networkWalletSub: Subscription = null;
  private activeNetworkSub: Subscription = null;
  private subWalletsListChangeSub: Subscription = null;
  private currencyChangeSub: Subscription = null;
  private transactionPublishedSub: Subscription = null;
  private notificationsSub: Subscription = null;
  private networkTemplateSub: Subscription = null;
  private balanceRefreshInterval: ReturnType<typeof setInterval> = null;

  // Header
  public identityName = '';
  public didShort: string = null;
  public avatarDataUrl: string = null;
  public hasNewNotifications = false;
  public networkBanner: string = null;
  public currentNetwork: AnyNetwork = null;
  public allChainsOn = false;
  public readonly allChainsGlyphLogos = ALL_CHAINS_GLYPH_LOGOS;
  private aggRowsSub: Subscription = null;

  // TODO(SCR-054): the Value pillar sub is meant to show live "N networks · M staked".
  // That needs real cross-network balance + staking aggregation (not yet available),
  // and the previous getter fabricated it (counted ALL enabled networks and hardcoded
  // "0 staked"). Until the aggregation exists we show the honest static descriptor
  // ('launcher.home-pillar-value-sub') from the template rather than false numbers.

  // Wallet summary
  public balanceVm: HomeBalanceVm = null;
  public totalFiatDisplay: string = null; // active wallet fiat total, shown on the Value pillar
  public pnlVm: { text: string; tone: 'up' | 'down' } = null; // local 24h PnL, null until enough history
  public tokenRows: HomeTokenRow[] = null;
  public walletUnavailable = false; // active wallet has no network wallet on the active network
  // True once the wallet service finished initializing: the hero/tiles/tokens
  // skeletons show only before this, so a user with zero wallets is not left
  // staring at placeholders that will never resolve.
  public walletServiceReady = false;
  public readonly mask = HIDDEN_MASK;
  private hideBalances = false;
  private hideBalancesLoaded = false;
  private networkWallet: AnyNetworkWallet = null;

  constructor(
    public theme: GlobalThemeService,
    public didService: DIDManagerService,
    private globalNetworksService: GlobalNetworksService,
    private globalNav: GlobalNavService,
    private globalNotifications: GlobalNotificationsService,
    private globalPrefs: GlobalPreferencesService,
    private events: GlobalEvents,
    private launcherNotificationsService: NotificationManagerService,
    private walletService: WalletService,
    private walletNetworkService: WalletNetworkService,
    private currencyService: CurrencyService,
    private uiService: UiService,
    private coinTransferService: CoinTransferService,
    private voteService: VoteService,
    private stakingInitService: StakingInitService,
    private globalPopupService: GlobalPopupService,
    private walletNetworkUIService: WalletNetworkUIService,
    private aggService: AggregatedTokensService
  ) {}

  /** Masks amounts while the hide-balances pref is on, and (privacy-safe) while it is still loading. */
  public get effectiveHide(): boolean {
    return this.hideBalances || !this.hideBalancesLoaded;
  }

  ngOnInit() {
    this.launcherNotificationsService.init();

    // The wallet summary refreshes on the same signals wallet home uses to stay live:
    // wallet init, active network wallet / network, subwallet-list, currency and
    // transaction-published.
    this.walletServiceSub = this.walletService.walletServiceStatus.subscribe(initializationComplete => {
      if (initializationComplete) {
        this.walletServiceReady = true;
        this.refreshWalletData();
      }
    });
    this.networkWalletSub = this.walletService.activeNetworkWallet.subscribe(() => {
      if (this.walletService.walletServiceStatus.value) this.refreshWalletData();
    });
    this.activeNetworkSub = this.walletNetworkService.activeNetwork.subscribe(network => {
      this.currentNetwork = network;
      if (this.walletService.walletServiceStatus.value) this.refreshWalletData();
    });
    this.currencyChangeSub = this.currencyService.currencyChangedSubject.subscribe(() => {
      this.rebuildWalletSummary();
    });
    this.transactionPublishedSub = this.events.subscribe('wallet:transactionpublished', () => {
      void this.updateActiveWallet();
    });

    this.notificationsSub = this.globalNotifications.notifications.subscribe(notifications => {
      this.hasNewNotifications = notifications && notifications.length > 0;
    });

    this.networkTemplateSub = this.globalNetworksService.activeNetworkTemplate.subscribe(template => {
      switch (template) {
        case TESTNET_TEMPLATE: this.networkBanner = 'TEST NET Active'; break;
        case LRW_TEMPLATE: this.networkBanner = 'CR Private Net Active'; break;
        case MAINNET_TEMPLATE: default: this.networkBanner = null;
      }
    });

    // Aggregate rows land progressively (per network); re-render while the view is on.
    this.aggRowsSub = this.aggService.rows.subscribe(() => {
      if (this.allChainsOn) this.rebuildAggregateSummary();
    });
  }

  ngOnDestroy() {
    for (let sub of [
      this.walletServiceSub, this.networkWalletSub, this.activeNetworkSub,
      this.subWalletsListChangeSub, this.currencyChangeSub, this.transactionPublishedSub,
      this.notificationsSub, this.networkTemplateSub, this.aggRowsSub
    ]) {
      sub?.unsubscribe();
    }
    this.walletServiceSub = this.networkWalletSub = this.activeNetworkSub = null;
    this.subWalletsListChangeSub = this.currencyChangeSub = this.transactionPublishedSub = null;
    this.notificationsSub = this.networkTemplateSub = this.aggRowsSub = null;
    this.stopBalanceRefreshInterval();
  }

  ionViewWillEnter() {
    Logger.log('launcher', 'Launcher home screen will enter');

    this.refreshIdentity();
    void this.loadHideBalances();
    this.refreshWalletData();
    this.startBalanceRefreshInterval();

    void this.loadAllChains().then(() => {
      if (!this.allChainsOn) return;
      this.refreshWalletData(); // re-render as aggregate now that the pref is known
      void this.aggService.ensureBuilt().then(() => {
        this.rebuildAggregateSummary(); // cached balances render instantly
        void this.aggService.refresh(); // fresh values fill in progressively
      });
    });
  }

  ionViewDidEnter() {
    Logger.log('launcher', 'Launcher home screen did enter');
    GlobalStartupService.instance.setStartupScreenReady();
  }

  ionViewWillLeave() {
    this.stopBalanceRefreshInterval();
  }

  /* ------------------------------ Header ------------------------------ */

  private refreshIdentity() {
    let identity = this.didService.signedIdentity;
    this.identityName = identity ? identity.name : '';
    this.didShort = this.shortenDid(DIDSessionsStore.signedInDIDString);
    this.avatarDataUrl = identity?.avatar
      ? `data:${identity.avatar.contentType};base64,${identity.avatar.base64ImageData}`
      : null;
  }

  /** Abbreviates a DID for display, e.g. did:elastos:iXk...9fQ. */
  private shortenDid(did: string): string {
    if (!did) return null;
    let body = did.replace('did:elastos:', '');
    if (body.length <= 8) return did;
    return `did:elastos:${body.slice(0, 3)}...${body.slice(-3)}`;
  }

  public async onNotifications() {
    if (this.modal || this.openingNotifications) return;
    this.openingNotifications = true;
    try {
      this.modal = await this.launcherNotificationsService.showNotifications(() => {
        this.modal = null;
      });
    } finally {
      this.openingNotifications = false;
    }
  }

  public onScan() {
    void this.globalNav.navigateTo(App.SCANNER, '/scanner/scan');
  }

  public onPickNetwork() {
    void this.walletNetworkUIService.chooseActiveNetwork(undefined, true).then(async changed => {
      if (!changed) return;
      await this.loadAllChains();
      this.refreshWalletData();
      if (this.allChainsOn) {
        await this.aggService.ensureBuilt();
        this.rebuildAggregateSummary();
        void this.aggService.refresh();
      }
    });
  }

  /* -------------------------- Wallet summary -------------------------- */

  /** Rebuilds the summary and (re)binds to the active network wallet's subwallet-list changes. */
  private refreshWalletData() {
    let networkWallet = this.walletService.activeNetworkWallet.value;

    if (networkWallet !== this.networkWallet) {
      this.networkWallet = networkWallet;
      this.subWalletsListChangeSub?.unsubscribe();
      this.subWalletsListChangeSub = null;
      if (networkWallet) {
        this.subWalletsListChangeSub = networkWallet.subWalletsListChange.subscribe(() => {
          if (this.allChainsOn) this.rebuildAggregateSummary();
          else this.rebuildWalletSummary();
        });
      }
    }

    if (this.allChainsOn) this.rebuildAggregateSummary();
    else this.rebuildWalletSummary();
  }

  /** Formats a fiat amount with the currency glyph prefix (e.g. "$4,286.40"), else a code suffix. */
  private formatFiat(amount: number, symbol: string): string {
    return formatFiatAmount(amount, symbol);
  }

  private rebuildWalletSummary() {
    if (!this.networkWallet) {
      this.balanceVm = null;
      this.totalFiatDisplay = null;
      this.pnlVm = null;
      this.tokenRows = null;
      // Distinguish "no wallets at all" from "active wallet unsupported on this network"
      // so the section shows an explanation instead of silently disappearing.
      this.walletUnavailable = this.walletService.getMasterWalletsCount() > 0;
      return;
    }
    this.walletUnavailable = false;

    // Figma is fiat-first: the hero shows the fiat total with the native balance
    // as a secondary line. When the active network has no price data we fall back
    // to native as the hero, so we never show a misleading "0" fiat over real tokens.
    let fiatBalance = this.networkWallet.getDisplayBalanceInActiveCurrency();
    let hasFiat = fiatBalance && !fiatBalance.isNaN();
    let nativeAmount = WalletUtil.getFriendlyBalance(
      this.networkWallet.getDisplayBalance(), this.networkWallet.getDecimalPlaces());
    let tokenName = this.networkWallet.getDisplayTokenName();
    let symbol = this.currencyService.selectedCurrency.symbol;
    if (hasFiat) {
      let fiatStr = this.formatFiat(fiatBalance.toNumber(), symbol);
      this.balanceVm = { primary: fiatStr, symbol: '', secondary: `${nativeAmount} ${tokenName}` };
      this.totalFiatDisplay = fiatStr;
      let pnl = PriceHistoryService.instance.getPortfolioPnl24h(this.networkWallet);
      this.pnlVm = pnl ? {
        text: `${pnl.absCurrency >= 0 ? '+' : '-'}${this.formatFiat(Math.abs(pnl.absCurrency), symbol)} (${pnl.pct.toFixed(1)}%)`,
        tone: pnl.absCurrency >= 0 ? 'up' : 'down'
      } : null;
    } else {
      this.balanceVm = { primary: nativeAmount, symbol: tokenName, secondary: null };
      this.totalFiatDisplay = null;
      this.pnlVm = null;
    }

    this.tokenRows = this.networkWallet
      .getSubWallets(WalletSortType.BALANCE)
      .filter(sw => sw.shouldShowOnHomeScreen())
      .slice(0, TOKENS_PREVIEW_COUNT)
      .map(sw => this.buildTokenRow(sw));
  }

  /** Fetches fresh balances for the active wallet, then rebuilds the summary. */
  private async updateActiveWallet() {
    if (this.allChainsOn) {
      // Aggregate refresh emits rows progressively; the rows subscription re-renders.
      await this.aggService.refresh();
      return;
    }
    if (!this.networkWallet) return;
    await this.networkWallet.update();
    this.rebuildWalletSummary();
  }

  /* ----------------------- All-chains aggregate ----------------------- */

  private async loadAllChains() {
    try {
      this.allChainsOn = await this.globalPrefs.getAllChainsMode(
        DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate);
    } catch (e) {
      // Keep the current mode on read failure; never override the user's choice.
    }
  }

  /** Aggregate-mode summary: merged rows plus the whole-portfolio hero. */
  private rebuildAggregateSummary() {
    if (!this.networkWallet) {
      this.balanceVm = null;
      this.totalFiatDisplay = null;
      this.pnlVm = null;
      this.tokenRows = null;
      this.walletUnavailable = this.walletService.getMasterWalletsCount() > 0;
      return;
    }
    this.walletUnavailable = false;

    const rows = this.aggService.rows.value;
    this.tokenRows = rows ? rows.map(r => this.buildAggregatedTokenRow(r)) : null;

    const symbol = this.currencyService.selectedCurrency.symbol;
    const fiatTotal = this.aggService.getAggregateFiatTotal();
    if (!fiatTotal.isNaN()) {
      const fiatStr = this.formatFiat(fiatTotal.toNumber(), symbol);
      this.balanceVm = { primary: fiatStr, symbol: '', secondary: null };
      this.totalFiatDisplay = fiatStr;
      const pnl = this.aggService.getAggregatePnl24h();
      this.pnlVm = pnl ? {
        text: `${pnl.absCurrency >= 0 ? '+' : '-'}${this.formatFiat(Math.abs(pnl.absCurrency), symbol)} (${pnl.pct.toFixed(1)}%)`,
        tone: pnl.absCurrency >= 0 ? 'up' : 'down'
      } : null;
    } else {
      // Nothing known yet (first ever run): an honest zero that fills in as balances land.
      this.balanceVm = { primary: this.formatFiat(0, symbol), symbol: '', secondary: null };
      this.totalFiatDisplay = null;
      this.pnlVm = null;
    }
  }

  private buildAggregatedTokenRow(r: AggregatedTokenRow): HomeTokenRow {
    const row = this.buildTokenRow(r.subWallet);
    row.network = r.network;
    row.badge = r.network.logo; // the chain is always identifiable in the merged list
    row.valueLoading = !r.hasValue;
    // The ELA instrument always wears the ELA mark; the chain lives on the badge.
    // (Generic ERC20 icons fall back to the network logo, which would double it.)
    if (r.isDefaultEla) row.icon = 'assets/wallet/coins/ela.png';
    // Same-symbol rows across chains: name the chain in the subtitle.
    row.native = `${row.native} · ${r.network.getEffectiveName()}`;
    return row;
  }

  private buildTokenRow(subWallet: AnySubWallet): HomeTokenRow {
    let fiatAmount = subWallet.getAmountInExternalCurrency(subWallet.getDisplayBalance());
    let symbol = this.currencyService.selectedCurrency.symbol;
    let title = this.uiService.getSubwalletTitle(subWallet);
    let balance = this.uiService.getFixedBalance(subWallet.getDisplayBalance());
    let pct = PriceHistoryService.instance.getPercentChange24h(
      subWallet.networkWallet.network.key, String(subWallet.id).toLowerCase());
    return {
      icon: subWallet.getMainIcon(),
      badge: subWallet.getSecondaryIcon(),
      title,
      native: `${balance} ${title}`,
      fiat: fiatAmount ? this.formatFiat(fiatAmount.toNumber(), symbol) : null,
      changePct: pct === null ? null : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
      changeTone: pct === null ? 'muted' : (pct >= 0 ? 'up' : 'down'),
      subWallet
    };
  }

  private startBalanceRefreshInterval() {
    if (this.balanceRefreshInterval !== null) return;
    this.balanceRefreshInterval = setInterval(() => {
      void this.updateActiveWallet();
    }, BALANCE_REFRESH_INTERVAL_MS);
  }

  private stopBalanceRefreshInterval() {
    if (this.balanceRefreshInterval !== null) {
      clearInterval(this.balanceRefreshInterval);
      this.balanceRefreshInterval = null;
    }
  }

  private async loadHideBalances() {
    try {
      this.hideBalances = await this.globalPrefs.getPreference(
        DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, 'ui.hidebalances');
    } catch (e) {
      this.hideBalances = false;
    }
    this.hideBalancesLoaded = true;
  }

  public toggleHideBalances() {
    this.hideBalances = !this.hideBalances;
    void this.globalPrefs.setPreference(
      DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, 'ui.hidebalances', this.hideBalances);
  }

  public hasWallet(): boolean {
    return !!this.networkWallet;
  }

  /**
   * Receive: point CoinTransferService at the main subwallet (coin-receive reads
   * masterWalletId/subWalletId from it) and open the receive screen. Mirrors the
   * Value screen's onReceive(), including the backup prompt for app-created wallets
   * whose identity was never backed up.
   */
  public onReceive() {
    // Backup nag comes FIRST (a not-backed-up app wallet risks losing received funds),
    // then the user chooses where to receive.
    if (this.networkWallet && this.networkWallet.masterWallet.creator === WalletCreator.WALLET_APP) {
      void this.receiveAfterBackupCheck();
    } else {
      void this.startReceive();
    }
  }

  private async receiveAfterBackupCheck() {
    const needsBackup = !(await GlobalDIDSessionsService.instance.activeIdentityWasBackedUp());
    if (!needsBackup) {
      void this.startReceive();
      return;
    }
    // Warn once, then respect the choice: confirm proceeds to receive, cancel aborts.
    const proceed = await this.globalPopupService.ionicConfirm('launcher.backup-title', 'launcher.backup-message');
    if (proceed) void this.startReceive();
  }

  /**
   * Receiving is chain-specific (one address per chain, receives every token on it). In
   * aggregate mode, pick a chain - which switches to it - then receive via the normal
   * path (coin-receive reads the ACTIVE network's wallet). Single mode receives on the
   * active chain.
   */
  private async startReceive() {
    if (this.allChainsOn) {
      let switched = await this.walletNetworkUIService.chooseActiveNetwork(undefined, false);
      if (!switched) return;
      let main = this.walletService.getActiveNetworkWallet()?.getMainTokenSubWallet();
      if (main) this.goReceive(main);
      return;
    }

    let main = this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    if (main) this.goReceive(main);
  }

  /** Point CoinTransferService at a chain's main subwallet (coin-receive reads it) and go. */
  private goReceive(main: AnySubWallet) {
    this.coinTransferService.masterWalletId = main.networkWallet.id;
    this.coinTransferService.subWalletId = main.id;
    void this.globalNav.navigateTo(App.WALLET, '/wallet/coin-receive');
  }

  /** Swap: the swap-providers screen for the main subwallet (mirrors the Value screen). */
  public onSwap() {
    if (this.allChainsOn && this.networkWallet) {
      // Aggregate mode: ask which token to swap (picker lists swappable tokens only).
      void this.globalNav.navigateTo(App.WALLET, '/wallet/coin-select-send', {
        state: { masterWalletId: this.networkWallet.id, mode: 'swap' }
      });
      return;
    }
    let main = this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    if (!main) return;
    this.coinTransferService.masterWalletId = main.networkWallet.id;
    this.coinTransferService.subWalletId = main.id;
    void this.globalNav.navigateTo(App.WALLET, '/wallet/coin-swap', {
      state: { masterWalletId: main.networkWallet.id, subWalletId: main.id }
    });
  }

  /** Stake: ELA DPoS staking app or TRON resource freezing (mirrors the Value screen). */
  public onStake() {
    let main = this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    if (!main) return;
    this.coinTransferService.masterWalletId = main.networkWallet.id;
    this.coinTransferService.subWalletId = main.id;
    if (this.canStakeTRX()) {
      void this.globalNav.navigateTo(App.WALLET, '/wallet/wallet-tron-resource');
    } else if (this.canStakeELA()) {
      // Aggregate mode: switch to mainchain silently so the staking flow's own
      // "switch network?" prompt never fires (same pattern as row taps).
      if (this.allChainsOn && this.currentNetwork?.key !== 'elastos') {
        void this.walletNetworkService.setActiveNetwork(this.walletNetworkService.getNetworkByKey('elastos'))
          .then(() => this.stakingInitService.start());
        return;
      }
      void this.stakingInitService.start();
    }
  }

  /** Whether the Swap tile should show: the active network exposes swap providers for the main token. */
  public canSwap(): boolean {
    if (this.allChainsOn) return this.hasSwappableAggregatedRow();
    let main = this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    if (!main) return false;
    return SwapService.instance.getAvailableSwapProviders(main).length > 0;
  }

  /** Aggregate mode: whether any merged row's token has a swap provider on its chain. */
  private hasSwappableAggregatedRow(): boolean {
    return (this.aggService.rows.value || [])
      .some(r => SwapService.instance.getAvailableSwapProviders(r.subWallet).length > 0);
  }

  /** Whether ELA staking is available (mirrors wallet-home.canStakeELA). */
  public canStakeELA(): boolean {
    if (!this.networkWallet) return false;
    // Aggregate mode: mainchain is always part of the portfolio, so staking stays offered.
    if (!this.allChainsOn && this.networkWallet.network.key !== 'elastos') return false;
    let status = this.voteService.dPoSStatus.value;
    return status === DposStatus.DPoSV2 || status === DposStatus.DPoSV1V2;
  }

  /** Whether TRON resource freezing (staking) is available (mirrors wallet-home.canStakeTRX). */
  public canStakeTRX(): boolean {
    let main = this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    return main instanceof TronSubWallet;
  }

  /** Whether the Stake tile should show at all. */
  public canStake(): boolean {
    return this.canStakeELA() || this.canStakeTRX();
  }

  /** Send opens the 2026 token picker first, then the transfer form for the chosen token. */
  public onSend() {
    let main = this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    if (!main) return;
    void this.globalNav.navigateTo(App.WALLET, '/wallet/coin-select-send', {
      state: { masterWalletId: main.networkWallet.id }
    });
  }

  public onTokenRow(row: HomeTokenRow) {
    // Aggregate rows may live on another chain: silently switch the active network
    // first so the coin screen opens in the right context.
    if (row.network && this.currentNetwork && row.network.key !== this.currentNetwork.key) {
      void this.walletNetworkService.setActiveNetwork(row.network).then(() => this.openTokenDetail(row));
      return;
    }
    this.openTokenDetail(row);
  }

  private openTokenDetail(row: HomeTokenRow) {
    void this.globalNav.navigateTo(App.WALLET, '/wallet/coin', {
      state: { masterWalletId: row.subWallet.networkWallet.id, subWalletId: row.subWallet.id }
    });
  }

  public trackToken(_index: number, row: HomeTokenRow): string {
    return `${row.network ? row.network.key : 'active'}-${row.subWallet.id}`;
  }

  /* ----------------------------- Pillars ------------------------------ */

  public onValue() {
    void this.globalNav.navigateTo(App.WALLET, '/wallet/wallet-home');
  }

  public onIdentity() {
    void this.globalNav.navigateTo(App.IDENTITY, '/identity/myprofile/home');
  }

  public onApps() {
    void this.globalNav.navigateTo(App.DAPP_BROWSER, '/dappbrowser/home');
  }
}
