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
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { AnySubWallet } from 'src/app/wallet/model/networks/base/subwallets/subwallet';
import { WalletUtil } from 'src/app/wallet/model/wallet.util';
import { WalletSortType } from 'src/app/wallet/model/walletaccount';
import { CurrencyService } from 'src/app/wallet/services/currency.service';
import { PriceHistoryService } from 'src/app/wallet/services/pricehistory.service';
import { formatFiatAmount } from 'src/app/helpers/currency-format';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
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

  /**
   * Value pillar sub "N networks · M staked" (SCR-054). Networks-with-value and the
   * staked total need multi-network balance data; until that is wired, show 0 on an
   * empty wallet (matching the design's empty state) rather than the enabled count.
   */
  public get valuePillarSub(): string {
    let fiat = this.networkWallet ? this.networkWallet.getDisplayBalanceInActiveCurrency() : null;
    let hasValue = !!(fiat && !fiat.isNaN() && fiat.gt(0));
    let networks = hasValue ? this.walletNetworkService.getDisplayableNetworks().length : 0;
    return `${networks} networks · 0 staked`;
  }

  // Wallet summary
  public balanceVm: HomeBalanceVm = null;
  public totalFiatDisplay: string = null; // active wallet fiat total, shown on the Value pillar
  public pnlVm: { text: string; tone: 'up' | 'down' } = null; // local 24h PnL, null until enough history
  public tokenRows: HomeTokenRow[] = null;
  public walletUnavailable = false; // active wallet has no network wallet on the active network
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
    private uiService: UiService
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
      if (initializationComplete) this.refreshWalletData();
    });
    this.networkWalletSub = this.walletService.activeNetworkWallet.subscribe(() => {
      if (this.walletService.walletServiceStatus.value) this.refreshWalletData();
    });
    this.activeNetworkSub = this.walletNetworkService.activeNetwork.subscribe(() => {
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
  }

  ngOnDestroy() {
    for (let sub of [
      this.walletServiceSub, this.networkWalletSub, this.activeNetworkSub,
      this.subWalletsListChangeSub, this.currencyChangeSub, this.transactionPublishedSub,
      this.notificationsSub, this.networkTemplateSub
    ]) {
      sub?.unsubscribe();
    }
    this.walletServiceSub = this.networkWalletSub = this.activeNetworkSub = null;
    this.subWalletsListChangeSub = this.currencyChangeSub = this.transactionPublishedSub = null;
    this.notificationsSub = this.networkTemplateSub = null;
    this.stopBalanceRefreshInterval();
  }

  ionViewWillEnter() {
    Logger.log('launcher', 'Launcher home screen will enter');

    this.refreshIdentity();
    void this.loadHideBalances();
    this.refreshWalletData();
    this.startBalanceRefreshInterval();
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

  public onSettings() {
    void this.globalNav.navigateTo(App.SETTINGS, '/settings/menu');
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
        this.subWalletsListChangeSub = networkWallet.subWalletsListChange.subscribe(() => this.rebuildWalletSummary());
      }
    }

    this.rebuildWalletSummary();
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
    if (!this.networkWallet) return;
    await this.networkWallet.update();
    this.rebuildWalletSummary();
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

  /** Receive/Swap/Stake land on the main token's coin home (v1 depth, D6). */
  public onMainAction() {
    let main = this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    if (!main) return;
    void this.globalNav.navigateTo(App.WALLET, '/wallet/coin', {
      state: { masterWalletId: main.networkWallet.id, subWalletId: main.id }
    });
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
    void this.globalNav.navigateTo(App.WALLET, '/wallet/coin', {
      state: { masterWalletId: row.subWallet.networkWallet.id, subWalletId: row.subWallet.id }
    });
  }

  public trackToken(_index: number, row: HomeTokenRow): string {
    return row.subWallet.id;
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
