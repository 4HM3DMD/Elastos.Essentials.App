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
  value: string;
  unit: string;
  fiat: string;
}

/** Precomputed strings for one row of the tokens preview. */
interface HomeTokenRow {
  icon: string;
  badge: string;
  title: string;
  balance: string;
  fiat: string;
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
  public avatarDataUrl: string = null;
  public hasNewNotifications = false;
  public networkBanner: string = null;

  // Wallet summary
  public balanceVm: HomeBalanceVm = null;
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
    this.avatarDataUrl = identity?.avatar
      ? `data:${identity.avatar.contentType};base64,${identity.avatar.base64ImageData}`
      : null;
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

  private rebuildWalletSummary() {
    if (!this.networkWallet) {
      this.balanceVm = null;
      this.tokenRows = null;
      // Distinguish "no wallets at all" from "active wallet unsupported on this network"
      // so the section shows an explanation instead of silently disappearing.
      this.walletUnavailable = this.walletService.getMasterWalletsCount() > 0;
      return;
    }
    this.walletUnavailable = false;

    let fiatBalance = this.networkWallet.getDisplayBalanceInActiveCurrency();
    let fiat = fiatBalance && !fiatBalance.isNaN()
      ? `${WalletUtil.getFriendlyBalance(fiatBalance)} ${this.currencyService.selectedCurrency.symbol}`
      : null;
    this.balanceVm = {
      value: WalletUtil.getFriendlyBalance(this.networkWallet.getDisplayBalance(), this.networkWallet.getDecimalPlaces()),
      unit: this.networkWallet.getDisplayTokenName(),
      fiat
    };

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
    return {
      icon: subWallet.getMainIcon(),
      badge: subWallet.getSecondaryIcon(),
      title: this.uiService.getSubwalletTitle(subWallet),
      balance: this.uiService.getFixedBalance(subWallet.getDisplayBalance()),
      fiat: fiatAmount ? `${fiatAmount.toString()} ${this.currencyService.selectedCurrency.symbol}` : null,
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

  /** Send/Receive/Transfer/Stake land on the main token's coin home (v1 depth, D6). */
  public onMainAction() {
    let main = this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    if (!main) return;
    void this.globalNav.navigateTo(App.WALLET, '/wallet/coin', {
      state: { masterWalletId: main.networkWallet.id, subWalletId: main.id }
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
