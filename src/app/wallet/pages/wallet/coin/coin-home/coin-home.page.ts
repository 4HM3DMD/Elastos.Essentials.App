/*
 * Copyright (c) 2021 Elastos Foundation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BigNumber } from 'bignumber.js';
import * as moment from 'moment';
import { Subscription } from 'rxjs';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { TitleBarIcon, TitleBarIconSlot, TitleBarMenuItem } from 'src/app/components/titlebar/titlebar.types';
import { runDelayed } from 'src/app/helpers/sleep.helper';
import { Logger } from 'src/app/logger';
import { Util } from 'src/app/model/util';
import { GlobalDIDSessionsService } from 'src/app/services/global.didsessions.service';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalStorageService } from 'src/app/services/global.storage.service';
import { DIDSessionsStore } from 'src/app/services/stores/didsessions.store';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { DposStatus, VoteService } from 'src/app/voting/services/vote.service';
import { StakingInitService } from 'src/app/voting/staking/services/init.service';
import { WarningComponent } from 'src/app/wallet/components/warning/warning.component';
import { ExtendedTransactionInfo } from 'src/app/wallet/model/extendedtxinfo';
import { WalletCreator } from 'src/app/wallet/model/masterwallets/wallet.types';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { MainChainSubWallet } from 'src/app/wallet/model/networks/elastos/mainchain/subwallets/mainchain.subwallet';
import { EthContractEvent } from 'src/app/wallet/model/networks/evms/ethtransactioninfoparser';
import { TransactionListType } from 'src/app/wallet/model/networks/evms/evm.types';
import { ERC20SubWallet } from 'src/app/wallet/model/networks/evms/subwallets/erc20.subwallet';
import { TRC20SubWallet } from 'src/app/wallet/model/networks/tron/subwallets/trc20.subwallet';
import { TronSubWallet } from 'src/app/wallet/model/networks/tron/subwallets/tron.subwallet';
import { WalletUtil } from 'src/app/wallet/model/wallet.util';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { Config } from '../../../../config/Config';
import { CoinType, StandardCoinName } from '../../../../model/coin';
import { AnySubWallet } from '../../../../model/networks/base/subwallets/subwallet';
import {
  AnyOfflineTransaction,
  GenericTransaction,
  OfflineTransactionType,
  TransactionInfo,
  TransactionType
} from '../../../../model/tx-providers/transaction.types';
import { CoinTransferService, TransferType } from '../../../../services/cointransfer.service';
import { CurrencyService } from '../../../../services/currency.service';
import { ChartRange, PriceHistoryService } from '../../../../services/pricehistory.service';
import { Native } from '../../../../services/native.service';
import { LocalStorage } from '../../../../services/storage.service';
import { UiService } from '../../../../services/ui.service';
import { WalletService } from '../../../../services/wallet.service';
import { CoinTxInfoParams } from '../coin-tx-info/coin-tx-info.page';

// LOGIC:data-semantics — exact transaction-name translation keys that denote a staking/resource
// operation across ELA mainchain (stake/unstake/vote/claim-reward) and Tron (freeze/unfreeze/
// withdraw-expire-unfreeze). Keys are locale-invariant, so matching them is language-agnostic.
const STAKING_TX_NAME_KEYS = new Set<string>([
  'wallet.coin-op-stake',
  'wallet.coin-op-unstake',
  'wallet.coin-op-vote',
  'wallet.coin-op-dpos2-claim-reward',
  'wallet.coin-op-freeze',
  'wallet.coin-op-unfreeze',
  'wallet.coin-op-withdraw'
]);

@Component({
  selector: 'app-coin-home',
  templateUrl: './coin-home.page.html',
  styleUrls: ['./coin-home.page.scss']
})
export class CoinHomePage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;
  @ViewChild('fetchmoretrigger', { static: true }) fetchMoreTrigger: ElementRef;

  public masterWalletInfo = '';
  public networkWallet: AnyNetworkWallet = null;
  public subWallet: AnySubWallet = null;
  public subWalletId: StandardCoinName = null;
  public transferList: TransactionInfo[] = [];
  public extendedTxInfo: { [txHash: string]: ExtendedTransactionInfo } = {};
  public offlineTransactions: AnyOfflineTransaction[] = [];
  public transactionsLoaded = false;
  private transactions: GenericTransaction[] = []; // raw transactions received from the providers / cache

  public transactionListType = TransactionListType.NORMAL;
  public hasInternalTransactions = false;
  public hasRechargeTransactions = false;
  // Segmented control for the transaction lists, rebuilt when the available sets change.
  public txTabs: { key: string; label: string }[] = [];

  // Transaction-type filter (All / Sent / Received / Swap / Staked) — SYS-008.
  public txTypeFilter = 'all';
  public txTypeChips: { key: string; label: string }[] = [];

  // Onchain transactions bucketed into day groups (Today / Earlier) — SYS-007.
  public txGroups: { key: string; label: string; items: TransactionInfo[] }[] = [];

  public stakedBalance = null; // Staked on ELA main chain or Tron

  // Local price-history driven chart + 24h change (null until enough history has accrued).
  public chartRange: ChartRange = '1D';
  public readonly rangeChips: { key: string; label: string }[] = [
    { key: '1D', label: '1D' }, { key: '1W', label: '1W' }, { key: '1M', label: '1M' }, { key: '1Y', label: '1Y' }
  ];
  public priceSeriesVm: number[] | null = null;
  public coinPercentChangeVm: { text: string; tone: 'up' | 'down' } | null = null;

  // Total transactions today
  public todaysTransactions = 0;
  // Only for fetchMoreTransactions
  private prevTransactionCount = 0;
  //private MaxCount = 0;
  private start = 0;

  // Helpers
  public WalletUtil = WalletUtil;
  public SELA = Config.SELA;
  public CoinType = CoinType;

  public canFetchMore = true;
  public shouldShowLoadingSpinner = false;
  public shouldShowAllActions: boolean = null;
  // Observer that detects when the "fetch more trigger" UI item crosses the ion-content, which means we
  // are at the bottom of the list.
  private fetchMoreTriggerObserver: IntersectionObserver;

  private transactionListChangedSubscription: Subscription = null;
  private transactionFetchStatusChangedSubscription: Subscription = null;
  private extendedInfoChangeSubscription: Subscription = null;
  private sendTransactionSubscription: Subscription = null;

  // SCR-095: per-token favourite state + titlebar click listener.
  public isFavorite = false;
  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void = null;

  private updateInterval = null;
  private updateTmeout = null;
  private updateTransactionsTimesamp = 0;

  public popover: any = null;

  constructor(
    public router: Router,
    public walletManager: WalletService,
    public translate: TranslateService,
    private coinTransferService: CoinTransferService,
    public native: Native,
    public events: GlobalEvents,
    private zone: NgZone,
    private popoverCtrl: PopoverController,
    public theme: GlobalThemeService,
    public currencyService: CurrencyService,
    public uiService: UiService,
    private storage: LocalStorage,
    private globalStorage: GlobalStorageService,
    private globalNav: GlobalNavService,
    private didSessions: GlobalDIDSessionsService,
    private platform: Platform,
    public stakingInitService: StakingInitService,
    private voteService: VoteService,
    private priceHistoryService: PriceHistoryService
  ) {
    void this.init();
  }

  ngOnDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.updateTmeout) {
      clearTimeout(this.updateTmeout);
      this.updateTmeout = null;
    }
    if (this.transactionListChangedSubscription) {
      this.transactionListChangedSubscription.unsubscribe();
      this.transactionListChangedSubscription = null;
    }
    if (this.transactionFetchStatusChangedSubscription) {
      this.transactionFetchStatusChangedSubscription.unsubscribe();
      this.transactionFetchStatusChangedSubscription = null;
    }
    if (this.extendedInfoChangeSubscription) {
      this.extendedInfoChangeSubscription.unsubscribe();
      this.extendedInfoChangeSubscription = null;
    }
    if (this.fetchMoreTriggerObserver) {
      this.fetchMoreTriggerObserver.disconnect();
      this.fetchMoreTriggerObserver = null;
    }
    if (this.sendTransactionSubscription) {
      this.sendTransactionSubscription.unsubscribe();
      this.sendTransactionSubscription = null;
    }
    // SCR-095: detach the titlebar favourite click listener.
    if (this.titleBarIconClickedListener) {
      this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
      this.titleBarIconClickedListener = null;
    }
  }

  ngAfterViewInit() {
    const options: IntersectionObserverInit = {
      root: this.fetchMoreTrigger.nativeElement.closest('.intersection-container')
    };
    this.fetchMoreTriggerObserver = new IntersectionObserver(
      (data: IntersectionObserverEntry[]): IntersectionObserverCallback => {
        if (data[0].isIntersecting) {
          this.fetchMoreTransactions();
          return;
        }
      },
      options
    );
    this.fetchMoreTriggerObserver.observe(this.fetchMoreTrigger.nativeElement);
  }

  ionViewWillEnter() {
    this.coinTransferService.subWalletId = this.subWalletId;
    // Figma parity (SCR-100): the nav title is the token symbol (e.g. "ELA" / "USDT").
    this.titleBar.setTitle(this.subWallet ? this.subWallet.getDisplayTokenName() : this.translate.instant('wallet.coin-transactions'));

    this.rebuildTxTabs();
    this.buildTxTypeChips();
    this.refreshPriceVm();
    void this.loadShowAllActions();
    // SCR-095: show the favourite toggle in the titlebar and reflect persisted state.
    if (!this.titleBarIconClickedListener) {
      this.titleBar.addOnItemClickedListener(
        (this.titleBarIconClickedListener = (menuIcon: TitleBarIcon) => {
          if (menuIcon.key === 'favorite') void this.toggleFavorite();
        })
      );
    }
    void this.loadFavorite();
  }

  ionViewWillLeave() {
    // SCR-095: hide the titlebar favourite icon when leaving the page.
    this.titleBar.setIcon(TitleBarIconSlot.OUTER_RIGHT, null);
  }

  /**
   * SCR-095: renders the favourite icon in the titlebar, tracking on/off state.
   * TODO(figma-asset): swap in a filled 'favorite-active' asset for the ON state
   * once exported; only the outline favorite.svg exists today.
   */
  private updateFavoriteIcon(): void {
    this.titleBar.setIcon(TitleBarIconSlot.OUTER_RIGHT, {
      key: 'favorite',
      iconPath: 'assets/components/titlebar/favorite.svg'
    });
  }

  private favoriteSettingKey(): string {
    return 'favorite-' + this.subWalletId;
  }

  public async loadFavorite(): Promise<void> {
    this.isFavorite = await this.globalStorage.getSetting(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'wallet',
      this.favoriteSettingKey(),
      false
    );
    this.updateFavoriteIcon();
  }

  public async toggleFavorite(): Promise<void> {
    this.isFavorite = !this.isFavorite;
    await this.globalStorage.setSetting(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'wallet',
      this.favoriteSettingKey(),
      this.isFavorite
    );
    this.updateFavoriteIcon();
  }

  // Cannot be async
  init() {
    const navigation = this.router.getCurrentNavigation();
    if (!Util.isEmptyObject(navigation.extras.state)) {
      let masterWalletId = navigation.extras.state.masterWalletId;
      this.subWalletId = navigation.extras.state.subWalletId as StandardCoinName;

      this.networkWallet = this.walletManager.getNetworkWalletFromMasterWalletId(masterWalletId);
      if (!this.networkWallet) {
        Logger.warn('wallet', 'coin-home error this.networkWallet = null,', masterWalletId);
        return;
      }
      this.coinTransferService.reset();
      this.coinTransferService.masterWalletId = masterWalletId;
      this.coinTransferService.subWalletId = this.subWalletId;

      this.subWallet = this.networkWallet.getSubWallet(this.subWalletId);

      void this.getStakedBalance();

      this.startUpdateInterval();
    }

    void this.initData(true);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.transactionListChangedSubscription = this.subWallet.transactionsListChanged().subscribe(value => {
      if (value === null) return; // null is the initial value.

      this.updateTransactionsTimesamp = 0;
      void this.zone.run(async () => {
        await this.updateTransactions();
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.transactionFetchStatusChangedSubscription = this.subWallet
      .transactionsFetchStatusChanged()
      .subscribe(isFetching => {
        this.zone.run(() => {
          this.shouldShowLoadingSpinner = isFetching;
        });
      });

    this.extendedInfoChangeSubscription = this.networkWallet.extendedTransactionInfoUpdated.subscribe(info => {
      void this.zone.run(() => {
        this.extendedTxInfo[info.txHash] = info.extInfo;
      });
    });

    this.sendTransactionSubscription = this.events.subscribe('wallet:transactionpublished', () => {
      void this.updateWalletInfo();
    });
  }

  ngOnInit() {}

  async initData(updateAll = false) {
    // Initial transactions from cache.
    await this.updateTransactions();
    this.updateTransactionsTimesamp = 0; // Force to update transactions after fetch new transactions.

    this.shouldShowLoadingSpinner = true;
    if (updateAll) {
      // Must one by one.
      await this.subWallet.fetchNewestTransactions(TransactionListType.NORMAL),
      await this.subWallet.fetchNewestTransactions(TransactionListType.INTERNAL);
      await this.subWallet.fetchNewestTransactions(TransactionListType.RECHARGE);
    } else {
      void this.subWallet.fetchNewestTransactions(this.transactionListType);
    }
  }

  async updateTransactions() {
    // Avoid updating transactions too frequently.
    let currentTimesamp = moment().valueOf();
    if (currentTimesamp < this.updateTransactionsTimesamp + 10000) {
      return;
    }
    this.updateTransactionsTimesamp = currentTimesamp;
    this.start = 0;
    this.offlineTransactions = [];
    this.todaysTransactions = 0;
    await this.getOfflineTransactions();
    await this.getAllTx();
    await this.checkInternalTransactions();
    await this.checkRechargeTransactions();
  }

  async updateWalletInfo() {
    // Update balance and get the latest transactions.
    await this.subWallet.update();
    await this.getStakedBalance();
    this.refreshPriceVm();
    void this.initData();
  }

  async checkInternalTransactions() {
    if (this.subWallet.supportInternalTransactions() && !this.hasInternalTransactions) {
      let transactions = await this.subWallet.getTransactions(TransactionListType.INTERNAL);
      if (transactions && transactions.length > 0) {
        Logger.log('wallet', 'find internal transactions.');
        this.zone.run(() => {
          this.hasInternalTransactions = true;
          this.rebuildTxTabs();
        });
      }
    }
  }

  async checkRechargeTransactions() {
    if (this.subWallet.supportRechargeTransactions() && !this.hasRechargeTransactions) {
      let transactions = await this.subWallet.getTransactions(TransactionListType.RECHARGE);
      Logger.log('wallet', 'recharge transactions: ', transactions);
      if (transactions && transactions.length > 0) {
        Logger.log('wallet', 'find recharge transactions.');
        this.zone.run(() => {
          this.hasRechargeTransactions = true;
          this.rebuildTxTabs();
        });
      }
    }
  }

  startUpdateInterval() {
    if (this.updateInterval === null) {
      this.updateInterval = setInterval(() => {
        void this.updateWalletInfo();
      }, 30000); // 30s
    }
  }

  restartUpdateInterval() {
    clearInterval(this.updateInterval);
    this.updateInterval = null;
    this.startUpdateInterval();
  }

  chainIsELA(): boolean {
    return this.subWalletId === StandardCoinName.ELA;
  }

  chainIsETHSC(): boolean {
    return this.subWalletId === StandardCoinName.ETHSC;
  }

  chainIsERC20(): boolean {
    return this.subWallet instanceof ERC20SubWallet || this.subWallet instanceof TRC20SubWallet;
  }

  private async getOfflineTransactions() {
    this.offlineTransactions = (await this.subWallet.getOfflineTransactions()) || [];
  }

  async getAllTx() {
    let transactions = await this.subWallet.getTransactions(this.transactionListType);
    if (!transactions) {
      Logger.log('wallet', 'Can not get transaction');
      this.canFetchMore = false;
      return;
    }
    Logger.log('wallet', 'Got all transactions: ', transactions.length, this.subWallet.masterWallet.name);

    if (this.subWallet.canFetchMoreTransactions()) {
      this.canFetchMore = true;
    } else {
      this.canFetchMore = false;
    }

    /* TODO - "can fetch more" to be called on the subwalelt -> transactions provider if (this.MaxCount <= 20) {
            this.canShowMore = false;
        } */

    const today = moment(new Date()).startOf('day');
    let transferListTemp: TransactionInfo[] = [];
    for (let transaction of transactions) {
      const transactionInfo = await this.subWallet.getTransactionInfo(transaction);
      if (!transactionInfo) {
        Logger.log('wallet', 'Invalid transaction or transaction that need to be hidden!');
        continue;
      }

      if (this.chainIsETHSC() || this.chainIsERC20()) {
        transactionInfo.amount = transactionInfo.amount.isInteger()
          ? transactionInfo.amount.integerValue()
          : transactionInfo.amount;
      }

      // Check if transaction was made today and increment our counter if so.
      this.countAsDailyTransactionIfNeeded(today, transactionInfo.timestamp);

      transferListTemp.push(transactionInfo);

      let extTxInfo = await this.networkWallet.getExtendedTxInfo(transactionInfo.txid);
      this.extendedTxInfo[transactionInfo.txid] = extTxInfo;
    }

    this.transferList = transferListTemp;
    this.transactionsLoaded = true;
    this.rebuildTxGroups();

    //At least all transactions of today must be loaded.
    if (this.todaysTransactions == transactions.length && this.prevTransactionCount != transactions.length) {
      this.fetchMoreTransactions();
    }

    this.prevTransactionCount = transactions.length;
  }

  public onItem(item) {
    let params: CoinTxInfoParams = {
      masterWalletId: this.networkWallet.id,
      subWalletId: this.subWalletId,
      transactionInfo: item
    };
    this.native.go('/wallet/coin-tx-info', params);
  }

  /**
   * Offline transaction item was clicked
   */
  public onOfflineTransactionItem(item: AnyOfflineTransaction) {
    switch (item.type) {
      case OfflineTransactionType.MULTI_SIG_STANDARD:
        let params: CoinTxInfoParams = {
          masterWalletId: this.networkWallet.id,
          subWalletId: this.subWalletId,
          offlineTransaction: item
        };
        this.native.go('/wallet/coin-tx-info', params);
        break;
      default:
      // Nothing
    }
  }

  async receiveFunds() {
    if (this.networkWallet.masterWallet.creator === WalletCreator.WALLET_APP) {
      const needsBackup = !(await this.didSessions.activeIdentityWasBackedUp());
      if (needsBackup) {
        await this.showBackupPrompt();
      } else {
        this.native.go('/wallet/coin-receive');
      }
    } else {
      this.native.go('/wallet/coin-receive');
    }
  }

  async showBackupPrompt() {
    this.popover = await this.popoverCtrl.create({
      mode: 'ios',
      cssClass: 'wallet-warning-component',
      component: WarningComponent,
      componentProps: {
        title: this.translate.instant('launcher.backup-title'),
        message: this.translate.instant('launcher.backup-message')
      },
      translucent: false
    });

    this.popover.onWillDismiss().then(params => {
      this.popover = null;

      if (params && params.data && params.data.confirm) {
        void this.globalNav.navigateTo('identitybackup', '/identity/backupdid');
      } else {
        this.native.go('/wallet/coin-receive');
      }
    });

    return await this.popover.present();
  }

  sendFunds() {
    this.coinTransferService.transferType = TransferType.SEND;
    this.native.go('/wallet/coin-transfer');
  }

  transferFunds() {
    if (this.chainIsELA()) {
      this.rechargeFunds();
    } else {
      this.withdrawFunds();
    }
  }

  // mainchain to sidechain
  rechargeFunds() {
    this.coinTransferService.transferType = TransferType.RECHARGE;
    this.native.go('/wallet/coin-select');
  }

  // sidechain to mainchain
  withdrawFunds() {
    this.coinTransferService.transferType = TransferType.WITHDRAW;
    this.native.go('/wallet/coin-transfer');
  }

  fetchMoreTransactions() {
    this.restartUpdateInterval();
    this.start = this.transactions.length;

    // Give time for the spinner to show.
    runDelayed(() => this.subWallet.fetchMoreTransactions(), 100);
  }

  async doRefresh(event): Promise<void> {
    if (!this.uiService.returnedUser) {
      this.uiService.returnedUser = true;
      await this.storage.setVisit(true);
    }

    void this.updateWalletInfo();
    // TODO - FORCE REFRESH ALL COINS BALANCES ? this.currencyService.fetch();
    setTimeout(() => {
      event.target.complete();
    }, 500);
  }

  getIndexByTxId(txid: string) {
    return this.transferList.findIndex(e => e.txid === txid);
  }

  countAsDailyTransactionIfNeeded(today: moment.Moment, timestamp: number) {
    if (today.isSame(moment(timestamp).startOf('day'))) {
      this.todaysTransactions++;
    }
  }

  /** Returns the currency to be displayed for this coin. */
  /** Native balance for the shared amount display. */
  public get coinDisplayValue(): string {
    if (!this.subWallet) return '';
    return WalletUtil.getFriendlyBalance(this.subWallet.getDisplayBalance(), this.networkWallet.getDecimalPlaces());
  }

  public get coinDisplayUnit(): string {
    return this.subWallet ? this.subWallet.getDisplayTokenName() : '';
  }

  /** Fiat value for the amount display, or null when no rate is available (renders no line). */
  public get coinDisplayFiat(): string {
    if (!this.subWallet) return null;
    let fiat = this.subWallet.getAmountInExternalCurrency(this.subWallet.getDisplayBalance());
    return fiat && !fiat.isNaN() ? `${fiat.toString()} ${this.currencyService.selectedCurrency.symbol}` : null;
  }

  /** Rebuilds the transaction-list segmented control from the currently available lists. */
  public rebuildTxTabs() {
    let tabs = [{ key: 'normal', label: this.translate.instant('wallet.coin-transactions') }];
    if (this.hasInternalTransactions) {
      tabs.push({ key: 'internal', label: this.translate.instant('wallet.coin-internal-transactions') });
    }
    if (this.hasRechargeTransactions) {
      tabs.push({ key: 'recharge', label: this.translate.instant('wallet.coin-recharge-transactions') });
    }
    this.txTabs = tabs;
  }

  public get activeTxTab(): string {
    if (this.transactionListType === TransactionListType.INTERNAL) return 'internal';
    if (this.transactionListType === TransactionListType.RECHARGE) return 'recharge';
    return 'normal';
  }

  public onTxTabChange(key: string) {
    let type = key === 'internal' ? TransactionListType.INTERNAL
      : key === 'recharge' ? TransactionListType.RECHARGE
      : TransactionListType.NORMAL;
    this.setTransactionListType(type);
  }

  /** Builds the transaction-type filter chips (labels are locale-aware) — SYS-008. */
  public buildTxTypeChips() {
    this.txTypeChips = [
      { key: 'all', label: this.translate.instant('wallet.coin-filter-all') },
      { key: 'sent', label: this.translate.instant('wallet.coin-filter-sent') },
      { key: 'received', label: this.translate.instant('wallet.coin-filter-received') },
      // 'swap' chip omitted: there is no DEX-swap detection yet (matchesTxTypeFilter
      // returns false), so the chip would always yield an empty list. Re-add when a
      // real swap flag is threaded through TransactionInfo (Phase 11).
      { key: 'staked', label: this.translate.instant('wallet.coin-filter-staked') }
    ];
  }

  /** Applies the active type filter to a single transaction — SYS-008. */
  private matchesTxTypeFilter(item: TransactionInfo): boolean {
    switch (this.txTypeFilter) {
      case 'sent':
        return item.type === TransactionType.SENT;
      case 'received':
        return item.type === TransactionType.RECEIVED;
      case 'swap':
        // TODO(Phase 11): thread a real DEX-swap flag through TransactionInfo. The old
        // TRANSFER/isCrossChain heuristic mislabels self-sends and bridge transfers as
        // swaps, so keep this filter empty until proper detection lands.
        return false;
      case 'staked':
        return this.isStakingTransaction(item);
      default:
        return true;
    }
  }

  /**
   * Staking match — LOGIC:data-semantics.
   * item.name is a translation KEY (e.g. 'wallet.coin-op-stake'), not a localized string
   * (see getTransactionTitle, which feeds name through translate.instant). Matching the exact
   * set of staking-related keys is therefore language-agnostic — it does not break on localized
   * builds the way a substring match on the displayed text would.
   * TODO(Phase 11): thread a dedicated staking flag/raw-type through TransactionInfo so this no
   * longer depends on the display-name key at all.
   */
  private isStakingTransaction(item: TransactionInfo): boolean {
    return STAKING_TX_NAME_KEYS.has(item.name);
  }

  /** Fired when a filter chip is tapped — rebuilds the grouped list — SYS-008. */
  public onTxTypeFilterChange(key: string) {
    this.txTypeFilter = key;
    this.rebuildTxGroups();
  }

  /**
   * Buckets the filtered onchain transactions into Today / Earlier day groups (SYS-007).
   * Empty groups are omitted so no bare header shows.
   */
  public rebuildTxGroups() {
    let startOfToday = moment(new Date()).startOf('day').valueOf();
    let today: TransactionInfo[] = [];
    let earlier: TransactionInfo[] = [];
    for (let item of this.transferList) {
      if (!this.matchesTxTypeFilter(item)) {
        continue;
      }
      let ts = item.timestamp > 2147483647 ? item.timestamp : item.timestamp * 1000;
      if (ts >= startOfToday) {
        today.push(item);
      } else {
        earlier.push(item);
      }
    }
    let groups: { key: string; label: string; items: TransactionInfo[] }[] = [];
    if (today.length > 0) {
      groups.push({ key: 'today', label: this.translate.instant('wallet.coin-tx-group-today'), items: today });
    }
    if (earlier.length > 0) {
      groups.push({ key: 'earlier', label: this.translate.instant('wallet.coin-tx-group-earlier'), items: earlier });
    }
    this.txGroups = groups;
  }

  public trackByTxId(_index: number, item: TransactionInfo): string {
    return item.txid;
  }

  public trackByGroupKey(_index: number, group: { key: string }): string {
    return group.key;
  }

  getSubwalletTitle() {
    return this.subWallet.getFriendlyName();
  }

  coinCanBeTransferred() {
    return this.subWallet.supportsCrossChainTransfers();
  }

  // For FRC759 token on fusion network, We can only transfer parent token.
  coinCanBeSent() {
    return !(
      this.networkWallet.network.key === 'fusion' &&
      this.subWallet instanceof ERC20SubWallet &&
      (this.subWallet as ERC20SubWallet).hasParentWallet
    );
  }

  /**
   * Whether the active subwallet can display currency amounts or not. For example for now,
   * we are not able to display USD value for ERC20 tokens.
   */
  canDisplayCurrency(): boolean {
    return !(this.subWallet instanceof ERC20SubWallet);
  }

  closeRefreshBox() {
    this.uiService.returnedUser = true;
    void this.storage.setVisit(true);
  }

  public setTransactionListType(transactionlistType: TransactionListType) {
    this.transactionListType = transactionlistType;
    this.updateTransactionsTimesamp = 0;
    void this.initData(false);
  }

  public earn(subWallet: AnySubWallet) {
    // Prevent from subwallet main div to get the click (do not open transactions list)
    //event.preventDefault();
    //event.stopPropagation();

    this.native.go('/wallet/coin-earn', {
      masterWalletId: subWallet.networkWallet.masterWallet.id,
      subWalletId: subWallet.id
    });
  }

  /**
   * Returns the ion-col size for the transfer/send/receive row, based on the available features.
   */
  public transfersColumnSize(): number {
    if (this.coinCanBeTransferred()) return 4; // 3 columns - 3x4 = 12
    else return 6; // 2 columns - 2x6 = 12
  }

  public swapsColumnSize(): number {
    let item = 0;
    // if (this.canSwap()) item++;
    if (this.canEarn()) item++;
    if (this.canStakeELA()) item++;
    if (this.canStakeTRX()) item++;

    switch (item) {
      case 1:
        return 12; // 1 columns
      case 2:
        return 6; // 2 columns - 2x6 = 12
      default:
        return 4; // 3 columns - 3x4 = 12
    }
  }

  /**
   * Tells if this subwallet can do one of earn, swap or bridge operations
   */
  public canEarnSwapOrBridge(): boolean {
    return this.canEarn() || this.canStakeELA() || this.canStakeTRX() /* || this.canSwap() || this.canBridge() */;
  }

  public canEarn(): boolean {
    return this.subWallet.getAvailableEarnProviders().length > 0;
  }

  public canSwap(): boolean {
    // Disable chainge
    return false;
    // if (this.isIOS && !this.canBrowseInApp) {
    //     return false;
    // }
    // return this.chaingeSwapService.isNetworkSupported(this.networkWallet.network);
  }

  public canStakeELA(): boolean {
    let status = this.voteService.dPoSStatus.value;
    if (status == DposStatus.DPoSV2 || status == DposStatus.DPoSV1V2) {
      return WalletNetworkService.instance.isActiveNetworkElastosMainchain();
    } else {
      return false;
    }
  }

  public canStakeTRX(): boolean {
    return this.subWallet instanceof TronSubWallet;
  }

  // Deprecated
  /* public canBridge(): boolean {
        return false;
        //return this.subWallet.getAvailableBridgeProviders().length > 0;
    } */

  /**
   * Toggles and saves whether we should show more or less actions for the user in the footer.
   */
  public async toggleShowAllActions(): Promise<void> {
    this.shouldShowAllActions = !this.shouldShowAllActions;
    await this.globalStorage.setSetting(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'wallet',
      'coinhome-show-all-actions',
      this.shouldShowAllActions
    );
  }

  public async loadShowAllActions(): Promise<void> {
    this.shouldShowAllActions = await this.globalStorage.getSetting(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'wallet',
      'coinhome-show-all-actions',
      true
    );
  }

  /**
   * Whether the arrow to toggle show/hide all actions should be shown or
   * hidden (in case there is nothing to toggle).
   */
  public shouldShowAllActionsToggle(): boolean {
    // Wait for shouldShowAllActions to be loaded (not null)
    return this.canEarnSwapOrBridge() && this.shouldShowAllActions !== null;
  }

  public getActionToggleIcon(): string {
    if (this.shouldShowAllActions) {
      if (this.theme.darkMode) return 'assets/wallet/icons/white-down-arrow-large.svg';
      else return 'assets/wallet/icons/black-down-arrow-large.svg';
    } else {
      if (this.theme.darkMode) return 'assets/wallet/icons/white-up-arrow-large.svg';
      else return 'assets/wallet/icons/black-up-arrow-large.svg';
    }
  }

  /**
   * Displayable list item title for offline transactions
   */
  public getOfflineTransactionTitle(offlineTx: AnyOfflineTransaction): string {
    switch (offlineTx.type) {
      case OfflineTransactionType.MULTI_SIG_STANDARD:
        return this.translate.instant('wallet.offline-tx-pending-multisig');
      default:
        this.translate.instant('wallet.offline-tx-unknown-tx');
    }
  }

  public getOfflineTransactionDate(offlineTx: AnyOfflineTransaction): string {
    return WalletUtil.getDisplayDate(offlineTx.updated);
  }

  public getPayStatusIcon(transfer: TransactionInfo): string {
    return transfer.payStatusIcon;
  }

  public getTransactionTitle(transfer: TransactionInfo): string {
    /* // If we have a good extended info, use it. Otherwise, use the base transaction info 'name'
        let extTxInfo = this.extendedTxInfo[transfer.txid];
        if (extTxInfo && extTxInfo.evm && extTxInfo.evm.txInfo && extTxInfo.evm.txInfo.operation && extTxInfo.evm.txInfo.operation.description)
            return this.translate.instant(extTxInfo.evm.txInfo.operation.description, extTxInfo.evm.txInfo.operation.descriptionTranslationParams);
 */
    // SCR-155: compose the row title as "<SYMBOL> | <Action>" (e.g. "ELA | Sent")
    // so the token is always visible alongside the transaction action.
    if (transfer && transfer.name) {
      const action = this.translate.instant(transfer.name);
      const sym = this.subWallet ? this.subWallet.getDisplayTokenName() : '';
      return sym ? `${sym} | ${action}` : action;
    }
  }

  public getContractEvents(transfer: TransactionInfo): EthContractEvent[] {
    let extTxInfo = this.extendedTxInfo[transfer.txid];

    if (!extTxInfo || !extTxInfo.evm || !extTxInfo.evm.txInfo) return [];

    return extTxInfo.evm.txInfo.events;
  }

  public getStakeTitle() {
    if (this.networkWallet) {
      if (this.networkWallet.network.key === 'tron') {
        return 'wallet.resource-freeze-balance';
      }
    }
    return 'staking.staked';
  }

  public async getStakedBalance() {
    // Can't use WalletNetworkService.instance.isActiveNetworkElastosMainchain()
    // We got the activeNetworkWallet event first, but the WalletNetworkService.instance.isActiveNetworkElastosMainchain still return true.
    if (this.networkWallet) {
      if (this.networkWallet.network.key === 'elastos') {
        if (this.subWallet instanceof MainChainSubWallet) {
          this.stakedBalance = await this.subWallet.getStakedBalance();
        }
      } else if (this.networkWallet.network.key === 'tron') {
        if (this.subWallet instanceof TronSubWallet) {
          this.stakedBalance = await this.subWallet.getStakedBalance();
        }
      }
    }
  }

  public getStakedBalanceInNative() {
    return WalletUtil.getFriendlyBalance(new BigNumber(this.stakedBalance));
  }

  public goStakeApp() {
    void this.stakingInitService.start();
  }

  public goTronResource() {
    this.native.go('wallet-tron-resource');
  }

  /** Routes the Stake action to Tron resource freezing or ELA staking, whichever applies. */
  public onStakeAction() {
    if (this.canStakeTRX()) {
      this.goTronResource();
    } else {
      this.goStakeApp();
    }
  }

  public setChartRange(range: string) {
    this.chartRange = range as ChartRange;
    this.refreshPriceVm();
  }

  /**
   * Reads the local price history into the chart + %change view-models (stable references so the
   * sparkline only recomputes when the data actually changes). Both stay null until enough history
   * exists — nothing is fabricated.
   */
  private refreshPriceVm() {
    if (!this.subWallet) {
      this.priceSeriesVm = null;
      this.coinPercentChangeVm = null;
      return;
    }
    let networkKey = this.networkWallet.network.key;
    let tokenId = String(this.subWallet.id).toLowerCase();
    this.priceSeriesVm = this.priceHistoryService.getSeries(networkKey, tokenId, this.chartRange);
    // LOGIC:data-semantics — the %change must track the selected chart range, not always be 24h.
    // The series is oldest -> newest for the active range, so the range change is (last - first)/first.
    let pct = this.getPercentChangeForRange();
    this.coinPercentChangeVm = pct === null
      ? null
      : { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`, tone: pct >= 0 ? 'up' : 'down' };
  }

  /**
   * Percent change over the currently selected chart range, derived from the same series that
   * drives the chart so the two never disagree — LOGIC:data-semantics. Returns null when there is
   * not enough history (matching the chart, which also hides in that case).
   */
  private getPercentChangeForRange(): number | null {
    let series = this.priceSeriesVm;
    if (!series || series.length < 2) return null;
    let first = series[0];
    let last = series[series.length - 1];
    if (!(first > 0)) return null;
    return ((last - first) / first) * 100;
  }

  /**
   * SCR-097: readout shown while the user scrubs the chart — the price at the touched point,
   * fed by the sparkline's (scrub) index. Null when not scrubbing, so the hero shows the live value.
   */
  public scrubReadout: string | null = null;
  public onChartScrub(index: number | null): void {
    if (index === null || !this.priceSeriesVm || index < 0 || index >= this.priceSeriesVm.length) {
      this.scrubReadout = null;
      return;
    }
    this.scrubReadout = `${this.priceSeriesVm[index]} ${this.currencyService.selectedCurrency.symbol}`;
  }
}
