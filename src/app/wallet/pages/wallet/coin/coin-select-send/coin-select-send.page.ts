import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { Util } from 'src/app/model/util';
import { SubValueTone } from 'src/app/components/ui/ui-token-row/ui-token-row.component';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { AnySubWallet } from 'src/app/wallet/model/networks/base/subwallets/subwallet';
import { WalletSortType } from 'src/app/wallet/model/walletaccount';
import { PriceHistoryService } from 'src/app/wallet/services/pricehistory.service';
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
    private coinTransferService: CoinTransferService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation && navigation.extras.state && !Util.isEmptyObject(navigation.extras.state)) {
      this.masterWalletId = navigation.extras.state.masterWalletId;
    }
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('wallet.select-token'));
    this.init();
  }

  private init() {
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

  private buildRow(subWallet: AnySubWallet): SendTokenRow {
    let fiatAmount = subWallet.getAmountInExternalCurrency(subWallet.getDisplayBalance());
    let fiat = fiatAmount ? `${fiatAmount.toString()} ${this.currencyService.selectedCurrency.symbol}` : null;
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
    return row.subWallet.id;
  }

  /** Hands the chosen token to the transfer form via the shared CoinTransferService (as coin-home does). */
  public onRow(row: SendTokenRow) {
    this.coinTransferService.reset();
    this.coinTransferService.masterWalletId = this.masterWalletId;
    this.coinTransferService.subWalletId = row.subWallet.id;
    this.coinTransferService.transferType = TransferType.SEND;
    this.native.go('/wallet/coin-transfer');
  }
}
