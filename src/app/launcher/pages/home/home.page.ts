import { Component, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { IonSlides } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
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
import { GlobalStorageService } from 'src/app/services/global.storage.service';
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
import { WidgetContainerComponent } from '../../widgets/base/widget-container/widget-container.component';
import { WidgetsServiceEvents } from '../../widgets/services/widgets.events';
import { WidgetsService } from '../../widgets/services/widgets.service';

const HIDDEN_MASK = '••••••';

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
  @ViewChild('widgetsslides', { static: false }) widgetsSlides: IonSlides | undefined;
  @ViewChildren(WidgetContainerComponent) widgetContainersList: QueryList<WidgetContainerComponent>;

  private widgetContainers: WidgetContainerComponent[] = [];
  private modal: HTMLIonModalElement = null;

  private walletServiceSub: Subscription = null;
  private networkWalletSub: Subscription = null;
  private activeNetworkSub: Subscription = null;
  private notificationsSub: Subscription = null;
  private networkTemplateSub: Subscription = null;
  private widgetsEditionModeSub: Subscription = null;

  // Header
  public identityName = '';
  public avatarDataUrl: string = null;
  public hasNewNotifications = false;
  public networkBanner: string = null;

  // Wallet summary
  public balanceVm: HomeBalanceVm = null;
  public tokenRows: HomeTokenRow[] = null;
  public hideBalances = false;
  public readonly mask = HIDDEN_MASK;
  private networkWallet: AnyNetworkWallet = null;

  // Widget canvas
  public showSwipeIndicator = false; // First time only, for new identities
  public widgetsSlidesOpts = {
    autoHeight: true,
    spaceBetween: 10,
    initialSlide: 1 // Start at the middle (main) panel
  };
  public slidesShown = false;
  public activeScreenIndex = 1;
  public editingWidgets = false;
  private hasUserInteractedWithSlides = false;

  constructor(
    public storage: GlobalStorageService,
    public theme: GlobalThemeService,
    public didService: DIDManagerService,
    private globalNetworksService: GlobalNetworksService,
    private globalNav: GlobalNavService,
    private globalNotifications: GlobalNotificationsService,
    private globalPrefs: GlobalPreferencesService,
    private widgetsService: WidgetsService,
    private launcherNotificationsService: NotificationManagerService,
    private walletService: WalletService,
    private walletNetworkService: WalletNetworkService,
    private currencyService: CurrencyService,
    private uiService: UiService
  ) {
    this.widgetsService.registerContainer('left');
    this.widgetsService.registerContainer('main');
    this.widgetsService.registerContainer('right');
  }

  ngOnInit() {
    this.launcherNotificationsService.init();

    void this.storage
      .getSetting(DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, 'launcher', 'swipanimationshown', false)
      .then(swipeAnimationShown => {
        this.showSwipeIndicator = !swipeAnimationShown;
      });

    // The wallet summary refreshes on the same signals the active-wallet widget uses.
    this.walletServiceSub = this.walletService.walletServiceStatus.subscribe(initializationComplete => {
      if (initializationComplete) this.refreshWalletData();
    });
    this.networkWalletSub = this.walletService.activeNetworkWallet.subscribe(() => {
      if (this.walletService.walletServiceStatus.value) this.refreshWalletData();
    });
    this.activeNetworkSub = this.walletNetworkService.activeNetwork.subscribe(() => {
      if (this.walletService.walletServiceStatus.value) this.refreshWalletData();
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
    for (let sub of [this.walletServiceSub, this.networkWalletSub, this.activeNetworkSub, this.notificationsSub, this.networkTemplateSub]) {
      sub?.unsubscribe();
    }
    this.walletServiceSub = this.networkWalletSub = this.activeNetworkSub = this.notificationsSub = this.networkTemplateSub = null;
  }

  ionViewWillEnter() {
    Logger.log('launcher', 'Launcher home screen will enter');

    this.refreshIdentity();
    this.refreshWalletData();
    void this.loadHideBalances();

    this.widgetsEditionModeSub = WidgetsServiceEvents.editionMode.subscribe(editionMode => {
      this.editingWidgets = editionMode;

      if (this.widgetsSlides) {
        // Lock the slider during edition to avoid horizontal scrolling.
        void this.widgetsSlides.lockSwipes(editionMode);

        // Entering edition reveals extra content; the slider height must be
        // recomputed once that content is rendered or the page cannot scroll.
        setTimeout(() => {
          void this.widgetsSlides.updateAutoHeight(0);
        }, 500);
      }
    });

    this.initializeSlidesVisibility();
  }

  ionViewDidEnter() {
    Logger.log('launcher', 'Launcher home screen did enter');

    GlobalStartupService.instance.setStartupScreenReady();

    this.widgetContainers = this.widgetContainersList.toArray();

    if (!this.slidesShown) this.initializeSlidesVisibility();
  }

  ionViewWillLeave() {
    this.widgetsEditionModeSub?.unsubscribe();
    this.widgetsEditionModeSub = null;
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
    if (this.modal) return;
    this.modal = await this.launcherNotificationsService.showNotifications(() => {
      this.modal = null;
    });
  }

  public onScan() {
    void this.globalNav.navigateTo(App.SCANNER, '/scanner/scan');
  }

  public onSettings() {
    void this.globalNav.navigateTo(App.SETTINGS, '/settings/menu');
  }

  /* -------------------------- Wallet summary -------------------------- */

  private refreshWalletData() {
    this.networkWallet = this.walletService.activeNetworkWallet.value;
    if (!this.networkWallet) {
      this.balanceVm = null;
      this.tokenRows = null;
      return;
    }

    let fiatBalance = this.networkWallet.getDisplayBalanceInActiveCurrency();
    this.balanceVm = {
      value: WalletUtil.getFriendlyBalance(this.networkWallet.getDisplayBalance(), this.networkWallet.getDecimalPlaces()),
      unit: this.networkWallet.getDisplayTokenName(),
      fiat: fiatBalance ? `${WalletUtil.getFriendlyBalance(fiatBalance)} ${this.currencyService.selectedCurrency.symbol}` : null
    };

    this.tokenRows = this.networkWallet
      .getSubWallets(WalletSortType.BALANCE)
      .filter(sw => sw.shouldShowOnHomeScreen())
      .slice(0, 3)
      .map(sw => this.buildTokenRow(sw));
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

  private async loadHideBalances() {
    try {
      this.hideBalances = await this.globalPrefs.getPreference(
        DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, 'ui.hidebalances');
    } catch (e) {
      this.hideBalances = false;
    }
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

  /* --------------------------- Widget canvas -------------------------- */

  public toggleEditWidgets() {
    this.widgetsService.toggleEditionMode();
  }

  public addWidget() {
    this.widgetsService.enterEditionMode();
    this.widgetContainers[this.activeScreenIndex].addWidget();
  }

  private initializeSlidesVisibility() {
    if (this.slidesShown) return;

    // With initialSlide 1 the slider starts on the main panel; reveal it after
    // a short delay so it is positioned before becoming visible.
    setTimeout(() => {
      this.slidesShown = true;
    }, 50);
  }

  public onSlideTouchEnd() {
    this.hasUserInteractedWithSlides = true;
    this.dismissSwipeIndicator();
  }

  public async onSlideChange() {
    // Ignore initial, non-user slide changes emitted during setup.
    if (!this.hasUserInteractedWithSlides) return;

    if (this.widgetsSlides) {
      this.activeScreenIndex = await this.widgetsSlides.getActiveIndex();
      void this.widgetsSlides.update();
    }

    this.dismissSwipeIndicator();
  }

  private dismissSwipeIndicator() {
    if (!this.showSwipeIndicator) return;
    this.showSwipeIndicator = false;
    void this.storage.setSetting(
      DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, 'launcher', 'swipanimationshown', true);
  }
}
