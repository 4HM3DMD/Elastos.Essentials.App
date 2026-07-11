import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { DappBrowserService } from 'src/app/dappbrowser/services/dappbrowser.service';
import { Logger } from 'src/app/logger';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalIntentService } from 'src/app/services/global.intent.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { AnyNetworkWallet, WalletAddressInfo } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { AnySubWallet } from 'src/app/wallet/model/networks/base/subwallets/subwallet';
import { ERC20SubWallet } from 'src/app/wallet/model/networks/evms/subwallets/erc20.subwallet';
import { TRC20SubWallet } from 'src/app/wallet/model/networks/tron/subwallets/trc20.subwallet';
import { ElastosMainChainStandardNetworkWallet } from 'src/app/wallet/model/networks/elastos/mainchain/networkwallets/standard/mainchain.networkwallet';
import { TransactionInfoType } from 'src/app/wallet/model/tx-providers/transaction.types';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { AggregatedTokensService } from 'src/app/wallet/services/aggregated-tokens.service';
import { StandardCoinName } from '../../../../model/coin';
import { CoinTransferService } from '../../../../services/cointransfer.service';
import { Native } from '../../../../services/native.service';
import { WalletService } from '../../../../services/wallet.service';

/** Token standard label appended to the network name for token subwallets on known chains. */
const TOKEN_STANDARD_BY_NETWORK_KEY: { [networkKey: string]: string } = {
  ethereum: 'ERC20',
  bsc: 'BEP20',
  tron: 'TRC20'
};

@Component({
  selector: 'app-coin-receive',
  templateUrl: './coin-receive.page.html',
  styleUrls: ['./coin-receive.page.scss']
})
export class CoinReceivePage implements OnInit, OnDestroy {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;
  // SCR-068: reference to the QR card so saveImage() can export the rendered QR canvas.
  @ViewChild('qrCard', { static: false }) qrCard: ElementRef<HTMLElement>;

  public networkWallet: AnyNetworkWallet = null;
  private masterWalletId = '1';
  public subWalletId: string;
  private subWallet: AnySubWallet = null;
  public tokenName = '';
  public qrcode: string = null;
  // True when the receiving wallet/address could not be resolved (e.g. the active-network
  // map is mid-rebuild, or the wallet exposes no address): show a safe message, not a blank.
  public loadError = false;
  public isSingleAddress = false;
  public walletAddressInfo: WalletAddressInfo[] = [];
  public addressType = 0;
  // Chip control for wallets that expose more than one receiving address type.
  public addressChips: { key: string; label: string }[] = [];
  private selectSubscription: Subscription = null;

  constructor(
    public route: ActivatedRoute,
    public zone: NgZone,
    public events: GlobalEvents,
    public walletManager: WalletService,
    public native: Native,
    private coinTransferService: CoinTransferService,
    public theme: GlobalThemeService,
    private translate: TranslateService,
    public dappbrowserService: DappBrowserService,
    private globalIntentService: GlobalIntentService
  ) {}

  ngOnInit() {
    void this.init();
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('wallet.coin-receive-title', { coinName: this.tokenName }));
  }

  ngOnDestroy() {
    if (this.selectSubscription) {
      this.selectSubscription.unsubscribe();
    }
  }

  init() {
    this.masterWalletId = this.coinTransferService.masterWalletId;
    this.subWalletId = this.coinTransferService.subWalletId;

    // receiveNetworkKey is a ONE-SHOT: the multi-chain Receive page sets it so this screen
    // shows a specific chain's address (resolved from the all-chains side-instance, so the
    // active network is never switched). Consume it immediately - otherwise a stale key
    // would leak into a later, unrelated Receive navigation (e.g. an NFT receive) and show
    // the wrong chain's address.
    const receiveNetworkKey = this.coinTransferService.receiveNetworkKey;
    this.coinTransferService.receiveNetworkKey = null;

    if (receiveNetworkKey) {
      // A chain was chosen: it MUST resolve from its side-instance. If that instance is
      // gone (a sign-out / wallet-switch race), fail safe rather than silently falling back
      // to the active network and showing another chain's address on a Receive screen.
      this.networkWallet = AggregatedTokensService.instance
        ? AggregatedTokensService.instance.getInstanceByKey(receiveNetworkKey)
        : null;
      if (!this.networkWallet) {
        Logger.warn('wallet', 'coin-receive: no side-instance for chosen chain', receiveNetworkKey);
        this.loadError = true;
        return;
      }
    } else {
      // Single-network Receive: use the active network's wallet as before.
      this.networkWallet = this.walletManager.getNetworkWalletFromMasterWalletId(this.masterWalletId);
      if (!this.networkWallet) {
        // The active-network map is briefly empty while it rebuilds on a switch: fail safe
        // instead of dereferencing null and rendering a blank page.
        Logger.warn('wallet', 'coin-receive: no network wallet for', this.masterWalletId);
        this.loadError = true;
        return;
      }
    }

    this.subWallet = this.networkWallet.getSubWallet(this.subWalletId) || this.networkWallet.getMainTokenSubWallet();
    if (!this.subWallet) {
      Logger.warn('wallet', 'coin-receive: no subwallet for', this.subWalletId);
      this.loadError = true;
      return;
    }
    this.tokenName = this.subWallet.getDisplayTokenName();

    this.getAddress();
    this.isSingleAddressSubwallet();
  }

  isSingleAddressSubwallet() {
    if (this.subWalletId === StandardCoinName.ELA) {
      let elastosMainChainMasterWallet = this.networkWallet as ElastosMainChainStandardNetworkWallet;
      this.isSingleAddress = elastosMainChainMasterWallet.getNetworkOptions().singleAddress;
    } else {
      this.isSingleAddress = true;
    }
  }

  copyAddress() {
    void this.native.copyClipboard(this.qrcode);
    this.native.toast(this.translate.instant('common.copied-to-clipboard'));
  }

  getAddress() {
    this.walletAddressInfo = this.networkWallet.getAddresses() || [];
    if (this.walletAddressInfo.length === 0) {
      // No receiving address on this chain (e.g. mainchain imported by private key):
      // show the safe message rather than crashing on an out-of-bounds read below.
      Logger.warn('wallet', 'coin-receive: wallet exposed no addresses');
      this.loadError = true;
      return;
    }
    this.addressChips = this.walletAddressInfo.map((info, i) => ({ key: String(i), label: info.title }));

    this.setAddressType(0);
  }

  setAddressType(type: number) {
    const info = this.walletAddressInfo[type];
    if (!info) return;
    this.addressType = type;
    this.qrcode = info.address;
    Logger.log('wallet', 'Address', this.qrcode);
  }

  public get activeAddressType(): string {
    return String(this.addressType);
  }

  public onAddressTypeChange(key: string) {
    this.setAddressType(Number(key));
  }

  // Anti-poisoning emphasis (super-wallet pattern): the first and last characters are
  // what users compare, so they render bright while the middle stays muted. Poisoned
  // look-alike addresses match the ends far less often than the middle.
  private static readonly ADDRESS_EDGE_CHARS = 6;

  public get addressHead(): string {
    if (!this.qrcode || this.qrcode.length < 16) return this.qrcode || '';
    return this.qrcode.slice(0, CoinReceivePage.ADDRESS_EDGE_CHARS);
  }

  public get addressBody(): string {
    if (!this.qrcode || this.qrcode.length < 16) return '';
    return this.qrcode.slice(CoinReceivePage.ADDRESS_EDGE_CHARS, -CoinReceivePage.ADDRESS_EDGE_CHARS);
  }

  public get addressTail(): string {
    if (!this.qrcode || this.qrcode.length < 16) return '';
    return this.qrcode.slice(-CoinReceivePage.ADDRESS_EDGE_CHARS);
  }

  public get networkName(): string {
    if (!this.networkWallet) {
      return '';
    }
    const baseName = this.networkWallet.network.getEffectiveName();
    const standard = this.tokenStandardSuffix;
    return standard ? `${baseName} (${standard})` : baseName;
  }

  /** Token standard (ERC20/BEP20/TRC20) shown for token subwallets on known chains; empty for native coins. */
  private get tokenStandardSuffix(): string {
    if (!(this.subWallet instanceof ERC20SubWallet) && !(this.subWallet instanceof TRC20SubWallet)) {
      return '';
    }
    return TOKEN_STANDARD_BY_NETWORK_KEY[this.networkWallet.network.key] || '';
  }

  public get networkLogo(): string {
    return this.networkWallet ? this.networkWallet.network.logo : null;
  }

  /** Middle-ellipsized form of the current address for single-line display; the full value stays in qrcode for copy/QR. */
  public get shortAddress(): string {
    const address = this.qrcode;
    if (!address || address.length <= 16) {
      return address;
    }
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  }

  /** Shares the current receiving address through the system share sheet. */
  public shareAddress() {
    void this.globalIntentService.sendIntent('share', {
      title: this.translate.instant('wallet.coin-receive-title', { coinName: this.tokenName }),
      url: this.qrcode
    });
  }

  /**
   * SCR-068: exports the rendered QR code as a PNG and hands it to the system
   * share/save sheet. angularx-qrcode renders into a <canvas> inside the QR card,
   * so we read that canvas directly rather than rasterizing arbitrary DOM.
   */
  public saveImage() {
    const canvas = this.qrCard?.nativeElement?.querySelector('canvas');
    if (!canvas) {
      return;
    }
    const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
    void this.globalIntentService.sendIntent('share', {
      title: this.translate.instant('wallet.coin-receive-title', { coinName: this.tokenName }),
      url: dataUrl
    });
  }

  showAddressList() {
    if (!this.selectSubscription) {
      this.selectSubscription = this.events.subscribe('selectaddress', address => {
        this.zone.run(() => {
          this.qrcode = address;
        });
      });
    }
    this.native.go('/wallet/coin-address', {
      masterWalletId: this.masterWalletId,
      subWalletId: this.subWalletId
    });
  }

  openForBrowseMode() {
    let browserUrl = WalletNetworkService.instance.activeNetwork.value.getBrowserUrlByType(
      TransactionInfoType.ADDRESS,
      this.qrcode
    );
    if (browserUrl) {
      void this.dappbrowserService.openForBrowseMode(browserUrl, '');
    }
  }
}
