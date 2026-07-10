import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { formatFiatAmount } from 'src/app/helpers/currency-format';
import { Util } from 'src/app/model/util';
import { SubValueTone } from 'src/app/components/ui/ui-token-row/ui-token-row.component';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { AnySubWallet } from 'src/app/wallet/model/networks/base/subwallets/subwallet';
import { WalletSortType } from 'src/app/wallet/model/walletaccount';
import { AggregatedTokenRow } from 'src/app/wallet/model/aggregated-token';
import { AnyNetwork } from 'src/app/wallet/model/networks/network';
import { AggregatedTokensService } from 'src/app/wallet/services/aggregated-tokens.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { GlobalPreferencesService } from 'src/app/services/global.preferences.service';
import { DIDSessionsStore } from 'src/app/services/stores/didsessions.store';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import { PriceHistoryService } from 'src/app/wallet/services/pricehistory.service';
import { SwapService } from 'src/app/wallet/services/evm/swap.service';
import { CoinTransferService, TransferType } from '../../../../services/cointransfer.service';
import { CurrencyService } from '../../../../services/currency.service';
import { Native } from '../../../../services/native.service';
import { UiService } from '../../../../services/ui.service';
import { WalletService } from '../../../../services/wallet.service';

/** Precomputed row for the send token picker (keeps getters out of the template). */
interface SendTokenRow {
  icon: string;
  badge: string;
  title: string;
  sub: string; // native balance line
  fiat: string;
  changeSubValue: string | null; // local 24h %change, null until enough history
  tone: SubValueTone;
  subWallet: AnySubWallet;
  /** Aggregate mode: the chain this row lives on (picking switches to it). */
  network?: AnyNetwork;
}

/**
 * The 2026 "Select Token" screen: a searchable list of the active wallet's tokens shown as the
 * first step of a Send. Picking a token sets the CoinTransferService (the same hand-off coin-home
 * uses) and opens the transfer amount form.
 */
@Component({
  selector: 'app-coin-select-send',
  templateUrl: './coin-select-send.page.html',
  styleUrls: ['./coin-select-send.page.scss']
})
export class CoinSelectSendPage {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  private masterWalletId: string = null;
  /** What the picked token feeds into: the transfer form, the receive QR, or the swap screen. */
  private mode: 'send' | 'receive' | 'swap' = 'send';
  private networkWallet: AnyNetworkWallet = null;
  public rows: SendTokenRow[] = null;
  public shownRows: SendTokenRow[] = null;
  public searchKey = '';

  constructor(
    public router: Router,
    private walletManager: WalletService,
    public native: Native,
    public uiService: UiService,
    public currencyService: CurrencyService,
    private translate: TranslateService,
    private coinTransferService: CoinTransferService,
    private prefs: GlobalPreferencesService,
    private networkService: WalletNetworkService,
    private aggService: AggregatedTokensService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation && navigation.extras.state && !Util.isEmptyObject(navigation.extras.state)) {
      this.masterWalletId = navigation.extras.state.masterWalletId;
      if (navigation.extras.state.mode) this.mode = navigation.extras.state.mode;
    }
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('wallet.select-token'));
    void this.init();
  }

  private async init() {
    // All-chains mode: offer every aggregated token; picking one switches chain.
    let allChains = false;
    try {
      allChains = await this.prefs.getAllChainsMode(
        DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate);
    } catch (e) { /* default single-network list */ }

    if (allChains) {
      await this.aggService.ensureBuilt();
      let aggRows = this.aggService.rows.value || [];
      // Swap only lists tokens with a swap provider on their chain.
      if (this.mode === 'swap') {
        aggRows = aggRows.filter(r => SwapService.instance.getAvailableSwapProviders(r.subWallet).length > 0);
      }
      this.rows = aggRows.map(r => this.buildAggregatedRow(r));
      this.shownRows = this.rows;
      return;
    }

    this.networkWallet = this.walletManager.getNetworkWalletFromMasterWalletId(this.masterWalletId);
    if (!this.networkWallet) {
      this.rows = [];
      this.shownRows = [];
      return;
    }
    this.rows = this.networkWallet
      .getSubWallets(WalletSortType.BALANCE)
      .filter(subWallet => subWallet.shouldShowOnHomeScreen())
      .map(subWallet => this.buildRow(subWallet));
    this.shownRows = this.rows;
  }

  private buildAggregatedRow(r: AggregatedTokenRow): SendTokenRow {
    const row = this.buildRow(r.subWallet);
    row.network = r.network;
    row.badge = r.network.logo;
    if (r.isDefaultEla) row.icon = 'assets/wallet/coins/ela.png';
    row.sub = `${row.sub} · ${r.network.getEffectiveName()}`;
    return row;
  }

  private buildRow(subWallet: AnySubWallet): SendTokenRow {
    let fiatAmount = subWallet.getAmountInExternalCurrency(subWallet.getDisplayBalance());
    // SYS-013: reuse the shared fiat formatter so amounts read "$2,140.20" (glyph + grouping) like the rest of 2026.
    let fiat = fiatAmount ? formatFiatAmount(fiatAmount.toNumber(), this.currencyService.selectedCurrency.symbol) : null;
    let pct = PriceHistoryService.instance.getPercentChange24h(
      subWallet.networkWallet.network.key, String(subWallet.id).toLowerCase());
    return {
      icon: subWallet.getMainIcon(),
      badge: subWallet.getSecondaryIcon(),
      title: this.uiService.getSubwalletTitle(subWallet),
      sub: `${this.uiService.getFixedBalance(subWallet.getDisplayBalance())} ${subWallet.getDisplayTokenName()}`,
      fiat,
      changeSubValue: pct === null ? null : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
      tone: pct === null ? 'muted' : (pct >= 0 ? 'up' : 'down'),
      subWallet
    };
  }

  public onSearch() {
    if (!this.rows) {
      this.shownRows = null;
      return;
    }
    let key = this.searchKey.trim().toLowerCase();
    this.shownRows = key ? this.rows.filter(row => row.title.toLowerCase().includes(key)) : this.rows;
  }

  public trackRow(_index: number, row: SendTokenRow): string {
    return `${row.network ? row.network.key : 'active'}-${row.subWallet.id}`;
  }

  /** Hands the chosen token to the transfer form via the shared CoinTransferService (as coin-home does). */
  public onRow(row: SendTokenRow) {
    // Aggregate rows may live on another chain: switch silently, then continue
    // into the standard per-network transfer flow.
    if (row.network && this.networkService.activeNetwork.value?.key !== row.network.key) {
      void this.networkService.setActiveNetwork(row.network).then(() => this.continueToTransfer(row));
      return;
    }
    this.continueToTransfer(row);
  }

  private continueToTransfer(row: SendTokenRow) {
    this.coinTransferService.reset();
    this.coinTransferService.masterWalletId = row.subWallet.networkWallet.id;
    this.coinTransferService.subWalletId = row.subWallet.id;
    switch (this.mode) {
      case 'receive':
        this.native.go('/wallet/coin-receive');
        return;
      case 'swap':
        this.native.go('/wallet/coin-swap');
        return;
      default:
        this.coinTransferService.transferType = TransferType.SEND;
        this.native.go('/wallet/coin-transfer');
    }
  }
}
