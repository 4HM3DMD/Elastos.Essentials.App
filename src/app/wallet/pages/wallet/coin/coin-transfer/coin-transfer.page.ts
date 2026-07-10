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

import { Component, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Keyboard } from '@awesome-cordova-plugins/keyboard/ngx';
import { AlertController, IonContent, ModalController, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import BigNumber from 'bignumber.js';
import { Subscription } from 'rxjs';
import { MenuSheetMenu } from 'src/app/components/menu-sheet/menu-sheet.component';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { TitleBarIcon, TitleBarMenuItem } from 'src/app/components/titlebar/titlebar.types';
import { sleep } from 'src/app/helpers/sleep.helper';
import { formatFiatAmount } from 'src/app/helpers/currency-format';
import { WalletExceptionHelper } from 'src/app/helpers/wallet.helper';
import { Logger } from 'src/app/logger';
import { WalletPendingTransactionException } from 'src/app/model/exceptions/walletpendingtransaction.exception';
import { Web3Exception } from 'src/app/model/exceptions/web3.exception';
import { Util } from 'src/app/model/util';
import { BTCFeeSpeed, GlobalBTCRPCService } from 'src/app/services/global.btc.service';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalFirebaseService } from 'src/app/services/global.firebase.service';
import { GlobalIntentService } from 'src/app/services/global.intent.service';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalTranslationService } from 'src/app/services/global.translation.service';
import { GlobalTronGridService } from 'src/app/services/global.tron.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import {
  TransferWalletChooserComponent,
  WalletChooserComponentOptions
} from 'src/app/wallet/components/transfer-wallet-chooser/transfer-wallet-chooser.component';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { BTCSubWallet } from 'src/app/wallet/model/networks/btc/subwallets/btc.subwallet';
import { ElastosIdentityChainNetworkBase } from 'src/app/wallet/model/networks/elastos/evms/eid/network/eid.networks';
import { ElastosSmartChainNetworkBase } from 'src/app/wallet/model/networks/elastos/evms/esc/network/esc.networks';
import { ElastosEVMSubWallet } from 'src/app/wallet/model/networks/elastos/evms/subwallets/standard/elastos.evm.subwallet';
import { MainChainSubWallet } from 'src/app/wallet/model/networks/elastos/mainchain/subwallets/mainchain.subwallet';
import { EVMNetwork } from 'src/app/wallet/model/networks/evms/evm.network';
import { ETHTransactionStatus } from 'src/app/wallet/model/networks/evms/evm.types';
import { NFT, NFTType } from 'src/app/wallet/model/networks/evms/nfts/nft';
import { NFTAsset } from 'src/app/wallet/model/networks/evms/nfts/nftasset';
import { ERC20SubWallet } from 'src/app/wallet/model/networks/evms/subwallets/erc20.subwallet';
import { MainCoinEVMSubWallet } from 'src/app/wallet/model/networks/evms/subwallets/evm.subwallet';
import { TRC20SubWallet } from 'src/app/wallet/model/networks/tron/subwallets/trc20.subwallet';
import { TronSubWallet } from 'src/app/wallet/model/networks/tron/subwallets/tron.subwallet';
import { AddressUsage } from 'src/app/wallet/model/safes/addressusage';
import { WalletUtil } from 'src/app/wallet/model/wallet.util';
import { ERC1155Service } from 'src/app/wallet/services/evm/erc1155.service';
import { ERC721Service } from 'src/app/wallet/services/evm/erc721.service';
import { EVMService } from 'src/app/wallet/services/evm/evm.service';
import { IntentService } from 'src/app/wallet/services/intent.service';
import { NameResolvingService } from 'src/app/wallet/services/nameresolving.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { ContactsComponent } from '../../../../components/contacts/contacts.component';
import { TxConfirmComponent } from '../../../../components/tx-confirm/tx-confirm.component';
import { TxSuccessComponent } from '../../../../components/tx-success/tx-success.component';
import { Config } from '../../../../config/Config';
import * as CryptoAddressResolvers from '../../../../model/address-resolvers';
import { CoinType, StandardCoinName } from '../../../../model/coin';
import { MainCoinSubWallet } from '../../../../model/networks/base/subwallets/maincoin.subwallet';
import { AnySubWallet } from '../../../../model/networks/base/subwallets/subwallet';
import { CoinTransferService, Transfer, TransferType } from '../../../../services/cointransfer.service';
import { ContactsService } from '../../../../services/contacts.service';
import { CurrencyService } from '../../../../services/currency.service';
import { Native } from '../../../../services/native.service';
import { UiService } from '../../../../services/ui.service';
import { WalletService } from '../../../../services/wallet.service';
import { NetworkInfo } from '../coin-select/coin-select.page';
import { ERC20CoinService } from 'src/app/wallet/services/evm/erc20coin.service';
import { ElastosPGPNetworkBase } from 'src/app/wallet/model/networks/elastos/evms/pgp/network/pgp.networks';
import { ElastosEVMNetwork } from 'src/app/wallet/model/networks/elastos/network/elastos.evm.network';

@Component({
  selector: 'app-coin-transfer',
  templateUrl: './coin-transfer.page.html',
  styleUrls: ['./coin-transfer.page.scss'],
  providers: [Keyboard]
})
export class CoinTransferPage implements OnInit, OnDestroy {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;
  @ViewChild(IonContent) contentArea: IonContent;

  public networkWallet: AnyNetworkWallet;
  public tokensymbol = '';

  // Define transfer type
  public transferType: TransferType;
  public subWalletId: string;

  // User inputs
  public toAddress: string;
  public amount: number; // Here we can use JS "number" type, for now we consider we will never transfer a number that is larger than JS's MAX INT.
  public memo = '';
  public sendMax = false;

  // Amount hero denomination toggle (SCR-002). `amount` always stays in token units
  // (the transaction source of truth); `rawAmountInput` mirrors what the user typed in
  // the currently selected denomination so switching token<->fiat is jitter-free.
  public amountDenomination: 'token' | 'fiat' = 'token';
  public rawAmountInput = '';
  // The active quick-percent chip (0.25 / 0.5 / 0.75), or null when entering manually
  // or when Max is armed. Drives the highlighted state of the quick-amount chips.
  public activePercent: number | null = null;
  // Inline validation (super-wallet pattern: surface problems at input time, not at
  // Continue time). True when the typed recipient fails the network's address check.
  public toAddressInvalid = false;

  public displayBalanceString = '';
  public displayBalanceLocked = '';

  public inscriptionUtxoBalanceSATOnBTC: BigNumber;
  public inscriptionUtxoBalanceOnBTCString = '';

  // Display recharge wallets
  public fromSubWallet: AnySubWallet;
  public toSubWallet: AnySubWallet = null;
  public destNetworkInfo: NetworkInfo = null;
  // For cross chain transfer
  public useCustumReceiverAddress = false;

  // For ELA mainchain
  private feeOfELA: string = null;

  // For BTC
  private feeOfBTC: string = null;
  private btcFeerateUsed = BTCFeeSpeed.AVERAGE; // default
  private btcFeerates: {
    [index: number]: number;
  } = {};
  private customBtcFeerate: number = null; // Custom fee rate in sat/vB
  private isShowingBTCFeerateMenu = false;
  public useInscriptionUTXO = false;

  // For Tron
  private feeOfTRX: string = null;

  // User can set gas price and limit.
  private gasPrice: string = null;
  private gasLimit: string = null;
  private nonce = -1;

  // Tron
  private feeLimitOfTRX: number = null;

  // Intent
  private action = null;
  private intentId = null;
  private alreadySentIntentResponse = false;

  // NFT
  public nft: NFT = null;
  public nftAsset: NFTAsset = null;

  // Display memo
  public hideMemo = true;

  // Pay intent
  public amountCanBeEditedInPayIntent = true;
  // Precomputed 'ready to pay' flag for the PAY footer (the template must not call the async validator directly).
  public payValuesReady = true;
  // LOGIC:wrong-label — the specific reason the last validation failed, so the PAY footer can show
  // the real cause (invalid amount / address / withdraw minimum) instead of always 'Insufficient balance'.
  public payValidationMessageKey = 'wallet.insufficient-balance';
  private payReadyTimer: ReturnType<typeof setTimeout> = null;

  // Submit transaction
  public transaction: () => Promise<void> | void;

  // CryptoName and Contacts
  public addressName: string = null;

  // Helpers
  public Config = Config;
  public CoinType = CoinType;

  // Titlebar
  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

  // Modal
  private modal: any = null;

  // Addresses resolved from typed user friendly names (ex: user types "rong" -> resolved to rong's ela address)
  public suggestedAddresses: CryptoAddressResolvers.Address[] = [];
  private resolverNameTimeout = null;
  // SCR-025: pending long-press-to-paste timer on the address field.
  private addressPressTimer: ReturnType<typeof setTimeout> = null;

  private addressUpdateSubscription: Subscription = null;

  // Input
  public inputActive = false;

  private popover: any = null;
  private showContactsOption = false;
  private showCryptonamesOption = false;
  private publicationStatusSub: Subscription;
  private ethTransactionSpeedupSub: Subscription;

  public actionIsGoing = false;

  private navigateHomeAfterCompletion = true;

  constructor(
    public route: ActivatedRoute,
    public walletManager: WalletService,
    public coinTransferService: CoinTransferService,
    public native: Native,
    public events: GlobalEvents,
    public zone: NgZone,
    public theme: GlobalThemeService,
    private translate: TranslateService,
    public currencyService: CurrencyService,
    private globalIntentService: GlobalIntentService,
    public globalPopupService: GlobalPopupService,
    private intentService: IntentService,
    public uiService: UiService,
    public keyboard: Keyboard,
    private contactsService: ContactsService,
    private modalCtrl: ModalController,
    private popoverCtrl: PopoverController,
    private alertCtrl: AlertController,
    private nameResolvingService: NameResolvingService,
    private erc721Service: ERC721Service,
    private erc1155Service: ERC1155Service,
    private ethTransactionService: EVMService,
    private erc721service: ERC721Service,
    private erc20CoinService: ERC20CoinService,
  ) {}

  async ngOnInit() {
    await this.init();
    this.addressUpdateSubscription = this.events.subscribe('address:update', address => {
      this.zone.run(() => {
        this.toAddress = address;
        this.addressName = null;
      });
    });
  }

  ionViewWillEnter() {
    if (this.intentId) {
      this.titleBar.setNavigationMode(null);
    }
  }

  ionViewWillLeave() {
    if (this.native.popup) {
      this.native.popup.dismiss();
    }
  }

  ngOnDestroy() {
    if (this.payReadyTimer) clearTimeout(this.payReadyTimer);
    // Clear the SCR-025 long-press paste timer so it cannot fire on a destroyed
    // component (e.g. a gesture back cancels the touch before touchend).
    if (this.addressPressTimer) clearTimeout(this.addressPressTimer);
    if (this.addressUpdateSubscription) this.addressUpdateSubscription.unsubscribe();
    if (this.publicationStatusSub) this.publicationStatusSub.unsubscribe();
    if (this.ethTransactionSpeedupSub) this.ethTransactionSpeedupSub.unsubscribe();
    this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
    if (this.intentId) {
      if (!this.alreadySentIntentResponse) {
        void this.cancelPayment();
      }
    }
  }

  setContactsKeyVisibility(showKey: boolean) {
    this.showContactsOption = showKey;
  }

  setCryptonamesKeyVisibility(showKey: boolean) {
    this.showCryptonamesOption = showKey;
  }

  async init() {
    this.networkWallet = this.walletManager.getNetworkWalletFromMasterWalletId(this.coinTransferService.masterWalletId);
    this.transferType = this.coinTransferService.transferType;
    this.subWalletId = this.coinTransferService.subWalletId;

    this.fromSubWallet = this.networkWallet.getSubWallet(this.subWalletId);
    this.tokensymbol = this.fromSubWallet.getDisplayTokenName();

    this.displayBalanceString = this.uiService.getFixedBalance(
      this.networkWallet.subWallets[this.subWalletId].getDisplayBalance()
    );
    Logger.log('wallet', 'CoinTransferPage Balance', this.displayBalanceString)

    if (this.fromSubWallet instanceof MainCoinEVMSubWallet) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.publicationStatusSub = EVMService.instance.ethTransactionStatus.subscribe(async status => {
        Logger.log('wallet', 'CoinTransferPage ethTransactionStatus:', status);
        switch (status.status) {
          case ETHTransactionStatus.PACKED:
            if (this.navigateHomeAfterCompletion) {
              this.walletManager.native.setRootRouter('/wallet/wallet-home');
            }
            if (this.intentId) {
              let result = {
                published: true,
                txid: status.txId,
                status: 'published'
              };
              this.alreadySentIntentResponse = true;
              await this.globalIntentService.sendIntentResponse(result, this.intentId);
            }
            this.events.publish('wallet:transactionsent', { subwalletid: this.subWalletId, txid: status.txId });
            break;
          case ETHTransactionStatus.CANCEL:
            if (this.intentId) {
              let result = {
                published: false,
                txid: null,
                status: 'cancelled'
              };
              this.alreadySentIntentResponse = true;
              await this.globalIntentService.sendIntentResponse(result, this.intentId);
            }
            break;
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.ethTransactionSpeedupSub = EVMService.instance.ethTransactionSpeedup.subscribe(async status => {
        Logger.log('wallet', 'CoinTransferPage ethTransactionStatus:', status);
        if (status) {
          this.gasPrice = status.gasPrice;
          this.gasLimit = status.gasLimit;
          this.nonce = status.nonce;
          // Do Transaction
          await this.transaction();
          // Reset gas price.
          this.gasPrice = null;
          this.gasLimit = null;
          this.nonce = -1;
        }
      });
    }

    let network = null;
    switch (this.transferType) {
      // For Recharge Transfer
      case TransferType.RECHARGE:
        // Setup page display
        network = this.getELANetworkByID(this.coinTransferService.toSubWalletId as StandardCoinName);
        this.titleBar.setTitle(
          this.translate.instant('wallet.coin-transfer-recharge-title', { coinName: network.shortName })
        );
        this.toSubWallet = await this.getELASubwalletByID(this.coinTransferService.toSubWalletId as StandardCoinName);
        if (this.toSubWallet) {
          this.toAddress = this.toSubWallet.getCurrentReceiverAddress();
        } else {
          this.useCustumReceiverAddress = true;
          this.destNetworkInfo = this.coinTransferService.networkInfo;
        }
        // Setup params for recharge transaction
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.transaction = this.createRechargeTransaction;

        const crossChainFee = (network as ElastosEVMNetwork<any>).getCrossChainFee();
        const fee = 10000 + crossChainFee;
        this.feeOfELA = Util.toELA(fee);
        Logger.log('wallet', 'Cross chain fee', this.feeOfELA);
        Logger.log('wallet', 'Transferring from..', this.fromSubWallet);
        Logger.log('wallet', 'Transferring To..', this.toSubWallet);
        Logger.log('wallet', 'Subwallet address', this.toAddress);
        break;
      case TransferType.WITHDRAW:
        // Setup page display
        network = this.getELANetworkByID(this.coinTransferService.toSubWalletId as StandardCoinName);
        this.titleBar.setTitle(
          this.translate.instant('wallet.coin-transfer-withdraw-title', { coinName: network.shortName })
        );

        // Setup params for withdraw transaction
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.transaction = this.createWithdrawTransaction;

        this.toSubWallet = await this.getELASubwalletByID(StandardCoinName.ELA);
        if (this.toSubWallet) {
          this.toAddress = this.toSubWallet.getCurrentReceiverAddress();
        }
        this.gasLimit = (
          await (this.fromSubWallet as ElastosEVMSubWallet).estimateWithdrawTransactionGas(this.toAddress)
        ).toString();

        Logger.log('wallet', 'Transferring from..', this.fromSubWallet);
        Logger.log('wallet', 'Transferring To..', this.toSubWallet);
        Logger.log('wallet', 'Subwallet address', this.toAddress);
        break;
      // For Send Transfer
      case TransferType.SEND:
        // SCR-019: header reads "Send <TOKEN>" (reuse wallet.send-coin, already used by buttonTitle())
        this.titleBar.setTitle(this.translate.instant('wallet.send-coin', { coin: this.fromSubWallet.getDisplayTokenName() }));
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.transaction = this.createSendTransaction;

        if (this.subWalletId === StandardCoinName.ELA) {
          // Always show contacts app key
          // NOTE: picking a contact works only for elastos mainchain for now, until we get a better
          // standardization for credential types that could store wallet addresses.
          this.setContactsKeyVisibility(true);

          this.feeOfELA = '0.0001'; // ELA
        } else {
          try {
            if (this.networkWallet.network.isEVMNetwork()) {
              if (this.fromSubWallet instanceof MainCoinEVMSubWallet) {
                this.gasLimit = (await this.fromSubWallet.estimateTransferTransactionGas()).toString();
              } else if (this.fromSubWallet instanceof ERC20SubWallet) {
                this.gasLimit = (await this.fromSubWallet.estimateTransferTransactionGas()).toString();
              }
            } else if (this.fromSubWallet instanceof BTCSubWallet) {
              // estimate fees after input amount
            } else if (this.fromSubWallet instanceof TRC20SubWallet) {
              let feeSun = await this.fromSubWallet.estimateTransferTransactionGas();
              this.feeLimitOfTRX = Util.ceil(feeSun, 10000000);
              this.feeOfTRX = GlobalTronGridService.instance.fromSun(feeSun.toString()).toString();
            }
          } catch (err) {
            Logger.warn('wallet', 'estimateTransferTransactionGas exception:', err);
            await this.parseException(err);
          }
        }

        break;
      // For Pay Intent
      case TransferType.PAY:
        this.titleBar.setTitle(this.translate.instant('wallet.payment-title'));
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.transaction = this.createSendTransaction;

        Logger.log('wallet', 'Pay intent params', this.coinTransferService.payTransfer);
        this.toAddress = this.coinTransferService.payTransfer.toAddress;
        this.amount = this.coinTransferService.payTransfer.amount;
        this.memo = this.coinTransferService.payTransfer.memo;
        if (this.amount) {
          this.amountCanBeEditedInPayIntent = false;
        }
        this.action = this.coinTransferService.intentTransfer.action;
        this.intentId = this.coinTransferService.intentTransfer.intentId;

        if (this.subWalletId === StandardCoinName.ELA) {
          this.feeOfELA = '0.0001'; // ELA
        } else {
          try {
            if (this.networkWallet.network.isEVMNetwork()) {
              if (this.fromSubWallet instanceof MainCoinEVMSubWallet) {
                this.gasLimit = (await this.fromSubWallet.estimateTransferTransactionGas()).toString();
              } else if (this.fromSubWallet instanceof ERC20SubWallet) {
                this.gasLimit = (await this.fromSubWallet.estimateTransferTransactionGas()).toString();
              }
            }
          } catch (err) {
            Logger.warn('wallet', 'estimateTransferTransactionGas exception:', err);
            await this.parseException(err);
          }
        }
        this.refreshPayValuesReady();
        break;
      // Send NFT
      case TransferType.SEND_NFT:
        this.titleBar.setTitle(this.translate.instant('wallet.ext-tx-info-type-send-nft'));

        this.transaction = this.createSendNFTTransaction;

        // Retrieve the NFT
        let nftContractAddress = this.coinTransferService.nftTransfer.nft.contractAddress;
        this.nft = this.networkWallet.getNFTByAddress(nftContractAddress);

        // Retrieve the NFT asset
        let assetID = this.coinTransferService.nftTransfer.assetID;
        this.nftAsset = this.nft.getAssetById(assetID);

        let fromAddress = this.fromSubWallet.getCurrentReceiverAddress(AddressUsage.EVM_CALL);
        if (this.nft.type === NFTType.ERC721) {
          this.gasLimit = (
            await this.erc721Service.estimateTransferERC721TransactionGas(
              this.networkWallet,
              fromAddress,
              this.nft.contractAddress,
              this.nftAsset.id
            )
          )?.toString();
        } else if (this.nft.type === NFTType.ERC1155) {
          this.gasLimit = (
            await this.erc1155Service.estimateTransferERC1155TransactionGas(
              this.networkWallet,
              fromAddress,
              this.nft.contractAddress,
              this.nftAsset.id
            )
          )?.toString();
        }

        Logger.log('wallet', 'Initialization complete for NFT details', this.networkWallet, this.nft, this.nftAsset);
        break;
    }

    // Only show cryptonames key if user has previously used crypto names
    if (this.contactsService.contacts.length) {
      this.setCryptonamesKeyVisibility(true);
    }

    if (this.fromSubWallet instanceof BTCSubWallet) {
      void this.getAllBTCFeerate();
      let result = await this.fromSubWallet.getInscriptionUTXO();
      this.inscriptionUtxoBalanceSATOnBTC = result?.total;

      if (this.inscriptionUtxoBalanceSATOnBTC?.isGreaterThan(0)) {
        this.inscriptionUtxoBalanceOnBTCString = this.uiService.getFixedBalance(
          this.fromSubWallet.getDisplayAmount(this.inscriptionUtxoBalanceSATOnBTC)
        );
      }
    }

    void this.getBalanceSpendable();
  }

  private async getBalanceSpendable() {
    await this.fromSubWallet.updateBalanceSpendable();
    this.zone.run(() => {
      let balanceSpendable = this.fromSubWallet.getRawBalanceSpendable();
      let balance = this.fromSubWallet.getRawBalance();
      let margin = balance.minus(balanceSpendable);
      if (margin.gt(1000)) {
        // 1000 : SELA
        this.displayBalanceLocked = this.uiService.getFixedBalance(
          this.networkWallet.subWallets[this.subWalletId].getDisplayAmount(margin)
        );
        this.displayBalanceString = this.uiService.getFixedBalance(
          this.networkWallet.subWallets[this.subWalletId].getDisplayAmount(balanceSpendable)
        );
      }
    });
  }

  /**
   * Same chain, different "users"
   */
  async createSendTransaction() {
    await this.native.showLoading(this.translate.instant('common.please-wait'));

    // Call dedicated api to the source subwallet to generate the appropriate transaction type.
    // For example, ERC20 token transactions are different from standard coin transactions (for now - as
    // the spv sdk doesn't support ERC20 yet).
    let rawTx = null;
    try {
      if (this.fromSubWallet instanceof ERC20SubWallet || this.fromSubWallet instanceof MainCoinEVMSubWallet) {
        rawTx = await this.fromSubWallet.createPaymentTransaction(
          this.toAddress, // User input address
          new BigNumber(this.amount), // User input amount
          this.memo, // User input memo
          this.gasPrice,
          this.gasLimit,
          this.nonce
        );
      } else if (this.fromSubWallet instanceof BTCSubWallet) {
        // For custom fee rate, convert sat/vB to sat/kB
        let forcedSatPerKB = null;
        if (this.btcFeerateUsed === BTCFeeSpeed.CUSTOM && this.customBtcFeerate) {
          forcedSatPerKB = this.customBtcFeerate * 1000;
        }
        rawTx = await this.fromSubWallet.createPaymentTransaction(
          this.toAddress, // User input address
          new BigNumber(this.amount), // User input amount
          this.memo, // User input memo
          this.btcFeerateUsed,
          forcedSatPerKB,
          this.useInscriptionUTXO
        );
      } else if (this.fromSubWallet instanceof MainCoinSubWallet) {
        rawTx = await this.fromSubWallet.createPaymentTransaction(
          this.toAddress, // User input address
          new BigNumber(this.amount), // User input amount
          this.memo // User input memo
        );
      } else if (this.fromSubWallet instanceof TRC20SubWallet) {
        rawTx = await this.fromSubWallet.createPaymentTransaction(
          this.toAddress, // User input address
          new BigNumber(this.amount), // User input amount
          this.feeLimitOfTRX
        );
      } else {
        throw new Error('Unknown subwallet type used for payment!');
      }

      // SCR-035: dismiss the please-wait ion-loading before the publication sheet is presented,
      // so two progress overlays are not stacked on top of each other.
      await this.native.hideLoading();
      // SIGN AND PUBLISH
      await this.signAndSendRawTransaction(rawTx);
    } catch (err) {
      await this.parseException(err);
    }
    await this.native.hideLoading();
  }

  /**
   * From mainchain to sidechains (ID, ETH)
   */
  async createRechargeTransaction() {
    await this.native.showLoading(this.translate.instant('common.please-wait'));

    let rawTx = null;
    try {
      rawTx = await (this.fromSubWallet as MainChainSubWallet).createDepositTransaction(
        this.coinTransferService.toSubWalletId as StandardCoinName, // To subwallet id
        this.toAddress, // to address
        this.amount, // User input amount
        this.memo // Memo, not necessary
      );

      await this.signAndSendRawTransaction(rawTx);
    } catch (err) {
      await this.parseException(err);
    }

    await this.native.hideLoading();
  }

  /**
   * From sidechain (ID, ETH) to mainchain
   */
  async createWithdrawTransaction() {
    let rawTx = null;
    try {
      rawTx = await this.fromSubWallet.createWithdrawTransaction(
        this.toAddress,
        this.amount,
        this.memo,
        this.gasPrice,
        this.gasLimit,
        this.nonce
      );

      await this.signAndSendRawTransaction(rawTx);
    } catch (err) {
      await this.parseException(err);
    }
  }

  async createSendNFTTransaction() {
    await this.native.showLoading(this.translate.instant('common.please-wait'));

    let rawTx = null;
    try {
      let fromAddress = this.fromSubWallet.getCurrentReceiverAddress(AddressUsage.EVM_CALL);

      if (this.nft.type === NFTType.ERC721) {
        rawTx = await this.erc721Service.createRawTransferERC721Transaction(
          this.networkWallet,
          fromAddress,
          this.nft.contractAddress,
          this.nftAsset.id,
          this.toAddress,
          this.gasPrice,
          this.gasLimit
        );
      } else if (this.nft.type === NFTType.ERC1155) {
        rawTx = await this.erc1155Service.createRawTransferERC1155Transaction(
          this.networkWallet,
          fromAddress,
          this.nft.contractAddress,
          this.nftAsset.id,
          this.toAddress,
          this.gasPrice,
          this.gasLimit
        );
      }

      if (!rawTx) {
        // Probably failed to create transaction because of non standard NFT transfer methods in contracts.
        // Let user know
        await this.globalPopupService.ionicAlert('wallet.transaction-fail', 'wallet.nft-transaction-creation-error');
      } else {
        // SIGN AND PUBLISH
        await this.signAndSendRawTransaction(rawTx);
      }
    } catch (err) {
      await this.parseException(err);
    }
    await this.native.hideLoading();
  }

  private async signAndSendRawTransaction(rawTx) {
    if (rawTx) {
      const transfer = new Transfer();
      Object.assign(transfer, {
        masterWalletId: this.networkWallet.id,
        subWalletId: this.subWalletId,
        //rawTransaction: rawTx,
        action: this.action,
        intentId: this.intentId,
        // SCR-011/012: display-only context for the generic publication sheet (amount hero +
        // address row). Not read by signing; the transaction itself is already built in rawTx.
        // standardSendDisplay gates the send-hero so votes/staking/proposals (which also
        // publish via the generic loader) are NOT rendered as a "send amount to address".
        // Normalize the Send-Max sentinel (-1) to the real balance so the hero never shows "-1".
        standardSendDisplay: true,
        amount: this.amount == -1 ? this.networkWallet.subWallets[this.subWalletId].getDisplayBalance() : this.amount,
        toAddress: this.toAddress,
        memo: this.memo
      });

      GlobalFirebaseService.instance.logEvent('wallet_coin_transfer_send');

      const result = await this.fromSubWallet.signAndSendRawTransaction(rawTx, transfer);

      if (transfer.intentId) {
        this.alreadySentIntentResponse = true;
        await this.globalIntentService.sendIntentResponse(result, transfer.intentId);
      }
    } else {
      if (this.intentId) {
        this.alreadySentIntentResponse = true;
        await this.globalIntentService.sendIntentResponse({ txid: null, status: 'error' }, this.intentId);
      }
    }
  }

  async pasteFromClipboard() {
    const pasted = (await this.native.pasteFromClipboard()).trim();

    const isAddressValid = await this.isAddressValid(pasted);
    if (!isAddressValid) {
      // Do NOT keep the invalid value in the field - leaving it there let the Send
      // CTA enable with an unusable address. Clear it and surface the error.
      this.toAddress = null;
      this.addressName = null;
      this.native.toast_trans('wallet.not-a-valid-address');
      return;
    }
    this.toAddress = pasted;
  }

  /** SCR-025: press-and-hold the address field to paste from the clipboard. */
  public onAddressPressStart() {
    if (this.addressPressTimer) {
      clearTimeout(this.addressPressTimer);
    }
    this.addressPressTimer = setTimeout(() => {
      this.addressPressTimer = null;
      void this.pasteFromClipboard();
    }, 600);
  }

  /** SCR-025: a short tap (or a move) cancels the pending long-press paste. */
  public onAddressPressEnd() {
    if (this.addressPressTimer) {
      clearTimeout(this.addressPressTimer);
      this.addressPressTimer = null;
    }
  }

  /** SCR-007: first glyph shown in the resolved-recipient avatar disc. */
  public get recipientInitial(): string {
    const source = (this.addressName || this.toAddress || '').trim();
    return source ? source.charAt(0).toUpperCase() : '?';
  }

  /** SCR-007: middle-truncate a long address for the recipient card. */
  public middleEllipsis(value: string): string {
    if (!value) {
      return '';
    }
    if (value.length <= 16) {
      return value;
    }
    return `${value.slice(0, 8)}...${value.slice(-6)}`;
  }

  /** SCR-007: clear the selected recipient and restore the address input. */
  public clearRecipient() {
    this.zone.run(() => {
      this.toAddress = '';
      this.addressName = null;
      this.suggestedAddresses = [];
    });
  }

  /** Recomputes the PAY footer 'insufficient balance' flag off the async validator. */
  public refreshPayValuesReady() {
    void this.checkValuesReady(false).then(ready => {
      this.zone.run(() => { this.payValuesReady = ready; });
    });
  }

  /**
   * Debounced from the editable pay amount input. checkValuesReady does fee
   * estimation (a network call for BTC) and can truncate the amount in place, so
   * it must not run on every keystroke — wait until the user pauses typing.
   */
  public onPayAmountInput() {
    if (this.payReadyTimer) clearTimeout(this.payReadyTimer);
    this.payReadyTimer = setTimeout(() => {
      this.payReadyTimer = null;
      this.refreshPayValuesReady();
    }, 600);
  }

  supportsMaxTransfer() {
    return !this.isTransferTypeSendNFT();
  }

  setMaxTransfer() {
    this.zone.run(() => {
      this.sendMax = true;
      // -1 means send all.
      this.amount = -1;
      // Max shows the token balance, so keep the hero in token units; otherwise a
      // prior fiat toggle would mislabel the shown balance (SCR-002).
      this.amountDenomination = 'token';
      this.rawAmountInput = '';
      this.activePercent = null;
    });
  }

  resetAmountInput() {
    this.sendMax = false;
    this.amount = null;
    this.rawAmountInput = '';
    this.amountDenomination = 'token';
    this.activePercent = null;
    this.useInscriptionUTXO = false;
  }

  /** Price of one token in the selected fiat, or null when pricing is unavailable. */
  private getCoinFiatPrice(): BigNumber | null {
    if (!this.fromSubWallet) return null;
    let price = this.fromSubWallet.getAmountInExternalCurrency(new BigNumber(1));
    return price ? price : null;
  }

  /** Unit suffix shown beside the hero amount (token ticker or fiat symbol). */
  public get heroUnitSymbol(): string {
    return this.amountDenomination === 'fiat'
      ? this.currencyService.selectedCurrency.symbol
      : this.tokensymbol;
  }

  /**
   * Converted value shown in the conversion pill: the fiat equivalent while entering in
   * token, or the token equivalent while entering in fiat. Null when no price is known yet.
   */
  public get conversionPillText(): string | null {
    let price = this.getCoinFiatPrice();
    if (!price || !this.amount || this.amount < 0) return null;
    let tokenAmount = new BigNumber(this.amount);
    if (this.amountDenomination === 'token') {
      let fiat = tokenAmount.multipliedBy(price);
      return formatFiatAmount(fiat.toNumber(), this.currencyService.selectedCurrency.symbol);
    }
    return `${tokenAmount.toString()} ${this.tokensymbol}`;
  }

  /** Hero input handler: keeps `amount` in token units regardless of the entry denomination. */
  public onHeroAmountInput(value: string) {
    this.rawAmountInput = value;
    if (!value) {
      this.amount = null;
      return;
    }
    let typed = new BigNumber(value);
    if (typed.isNaN()) {
      this.amount = null;
      return;
    }
    if (this.amountDenomination === 'fiat') {
      let price = this.getCoinFiatPrice();
      this.amount = price && price.gt(0) ? typed.dividedBy(price).toNumber() : typed.toNumber();
    } else {
      this.amount = typed.toNumber();
    }
  }

  /** Flips the hero between token and fiat entry, re-expressing the current amount. (SCR-002) */
  public toggleAmountDenomination() {
    let price = this.getCoinFiatPrice();
    if (!price || price.lte(0)) return;
    this.amountDenomination = this.amountDenomination === 'token' ? 'fiat' : 'token';
    if (this.amount && this.amount >= 0) {
      let tokenAmount = new BigNumber(this.amount);
      this.rawAmountInput = this.amountDenomination === 'fiat'
        ? tokenAmount.multipliedBy(price).toFixed(2)
        : tokenAmount.toString();
    }
  }

  /**
   * Value shown in the hero display: the full balance when Max is armed, the raw typed
   * string while entering, or a "0" placeholder when empty. The custom keypad renders
   * this rather than a native input, so the system keyboard never appears (SCR-002).
   */
  public get heroDisplayValue(): string {
    if (this.sendMax) return this.displayBalanceString;
    return this.rawAmountInput || '0';
  }

  /** True once a real amount exists, so the hero renders solid white (not the muted "0" placeholder). */
  public get heroHasValue(): boolean {
    return this.sendMax || this.rawAmountInput.length > 0;
  }

  /**
   * Custom on-screen numpad key press. Builds `rawAmountInput` locally (digits, a single
   * decimal point bounded by the token's decimals, and backspace) then re-parses it through
   * the existing hero handler so the token/fiat conversion stays the single source of truth.
   */
  public onAmountKey(key: string): void {
    this.zone.run(() => {
      // Typing always cancels an armed Max / quick-percent selection.
      this.sendMax = false;
      this.activePercent = null;

      let next = this.rawAmountInput || '';
      if (key === 'del') {
        next = next.slice(0, -1);
      } else if (key === '.') {
        if (next.includes('.')) return;
        next = next === '' ? '0.' : next + '.';
      } else {
        // Reject extra decimals beyond what the token (or fiat) supports.
        let maxDecimals = this.amountDenomination === 'fiat' ? 2 : (this.fromSubWallet?.tokenDecimals ?? 8);
        let dot = next.indexOf('.');
        if (dot >= 0 && next.length - dot - 1 >= maxDecimals) return;
        // Collapse a lone leading zero ("0" + "5" -> "5") but keep "0." building.
        next = next === '0' ? key : next + key;
      }
      this.onHeroAmountInput(next);
    });
  }

  /**
   * The token balance the quick-amount chips divide: the SAME spendable figure shown in
   * the "Available" line (getBalanceSpendable). Uses the spendable amount when locked
   * funds exist (margin > 1000 SELA), otherwise the full display balance — so a chip can
   * never exceed the number the user was just shown.
   */
  private getSpendableDisplayBalance(): BigNumber {
    let full = this.networkWallet.subWallets[this.subWalletId].getDisplayBalance();
    let spendableRaw = this.fromSubWallet.getRawBalanceSpendable();
    let fullRaw = this.fromSubWallet.getRawBalance();
    if (spendableRaw && fullRaw && fullRaw.minus(spendableRaw).gt(1000)) {
      return this.fromSubWallet.getDisplayAmount(spendableRaw);
    }
    return full;
  }

  /**
   * True when the entered amount exceeds the spendable balance - shown inline and blocking
   * Continue (super-wallet pattern), instead of only failing with a toast at Continue time.
   * Max (-1 sentinel) is exempt: send-all is resolved downstream.
   */
  public get amountExceedsBalance(): boolean {
    if (this.sendMax || !this.amount || this.amount <= 0) return false;
    if (!this.networkWallet || !this.subWalletId) return false;
    return new BigNumber(this.amount).gt(this.getSpendableDisplayBalance());
  }

  /**
   * Quick-amount chip: sets the entry to a fraction (0.25 / 0.5 / 0.75) of the spendable
   * balance. Always expressed in token units so the fraction is exact regardless of the
   * current fiat/token toggle, and rounded DOWN so it can never exceed the balance.
   */
  public setPercentAmount(fraction: number): void {
    this.zone.run(() => {
      this.sendMax = false;
      this.amountDenomination = 'token';
      this.activePercent = fraction;
      let decimals = Math.min(this.fromSubWallet?.tokenDecimals ?? 8, 8);
      let value = this.getSpendableDisplayBalance().multipliedBy(fraction).decimalPlaces(decimals, BigNumber.ROUND_DOWN);
      // toFixed() (no arg) never uses exponential notation, unlike toString(), so tiny
      // amounts stay a clean decimal string the keypad can keep appending to.
      this.onHeroAmountInput(value.toFixed());
    });
  }

  // if user has no inscription, or if not max clicked, don't show the toggle
  canShowToogleForInscription() {
    return this.sendMax && this.inscriptionUtxoBalanceSATOnBTC?.isGreaterThan(0);
  }

  async goTransaction() {
    this.actionIsGoing = true;
    if (await this.checkValuesReady()) {
      await this.startTransaction();
    }
    this.actionIsGoing = false;
  }

  private conditionalShowToast(message: string, showToast: boolean, duration = 4000) {
    // LOGIC:wrong-label — record the real failure reason so the PAY footer (which suppresses the
    // toast) can render the accurate message instead of a generic 'Insufficient balance'.
    this.payValidationMessageKey = message;
    if (showToast) this.native.toast_trans(message, duration);
  }

  /**
   * Make sure all parameters are right before sending a transaction or enabling the send button.
   */
  async checkValuesReady(showToast = true): Promise<boolean> {
    // LOGIC:wrong-label — default to a neutral reason; specific failures overwrite it via
    // conditionalShowToast(). Paths that return false without a toast fall back to this.
    this.payValidationMessageKey = 'wallet.cannot-complete-payment';
    // Make sure we have a destination address
    if (!this.toAddress) {
      this.conditionalShowToast('wallet.not-a-valid-address', showToast);
      return false;
    }

    if (this.fromSubWallet instanceof BTCSubWallet) {
      // Calculate fee after input amount
      let ret = await this.estimateBTCFees();
      if (!ret) return ret;
    }

    let fee: BigNumber = null;
    if (this.feeOfELA) {
      fee = new BigNumber(this.feeOfELA);
    } else if (this.feeOfBTC) {
      fee = new BigNumber(this.feeOfBTC).dividedBy(this.fromSubWallet.tokenAmountMulipleTimes);
    } else if (this.feeOfTRX) {
      fee = new BigNumber(this.feeOfTRX);
    } else if (this.fromSubWallet instanceof TronSubWallet) {
      // The fee is related to the receiving address.
      // If the address is not active,  you need to pay 1 TRX fee to activate this address.
      let feeSun = await this.fromSubWallet.estimateTransferTransactionGas(this.toAddress);
      this.feeLimitOfTRX = Util.ceil(feeSun, 10000000);
      this.feeOfTRX = GlobalTronGridService.instance.fromSun(feeSun.toString()).toString();
      fee = new BigNumber(this.feeOfTRX);
    } else if (this.gasLimit) {
      // LOGIC:fee-correctness — derive the native fee from the estimated gasLimit and the current
      // gas price (the same inputs createPaymentTransaction uses) instead of a hardcoded 0.0001,
      // which was only ever correct for Elastos ESC. Skip the check when no real estimate exists.
      const mainTokenSubWallet = this.networkWallet.getMainTokenSubWallet() as any as MainCoinEVMSubWallet<any>;
      let gasPriceWei = this.gasPrice;
      try {
        if (!gasPriceWei && mainTokenSubWallet) {
          gasPriceWei = await mainTokenSubWallet.getGasPrice();
        }
      } catch (e) {
        Logger.warn('wallet', 'checkValuesReady: unable to fetch gas price for fee pre-check:', e);
      }
      if (gasPriceWei && mainTokenSubWallet) {
        fee = new BigNumber(this.gasLimit).multipliedBy(gasPriceWei).dividedBy(mainTokenSubWallet.tokenAmountMulipleTimes);
      } else {
        fee = null;
      }
    } else {
      // No fee estimate available — skip the balance-covers-fee check rather than asserting a
      // bogus constant (which would either falsely pass or falsely block the transaction).
      fee = null;
    }

    // Check amount only when used (eg: no for NFT transfers)
    if (!this.isTransferTypeSendNFT()) {
      if (!this.sendMax) {
        if (Util.isNull(this.amount) || this.amount <= 0) {
          this.conditionalShowToast('wallet.amount-invalid', showToast);
          return false;
        }

        let amountString = this.amount.toString();
        let dotIndex = amountString.indexOf('.');
        if (dotIndex > -1 && amountString.split('.')[1].length > this.fromSubWallet.tokenDecimals) {
          this.amount = parseFloat(amountString.substring(0, dotIndex + this.fromSubWallet.tokenDecimals + 1));
        }

        let amountBigNumber = new BigNumber(this.amount || 0);
        if (this.fromSubWallet instanceof MainCoinSubWallet && fee) {
          amountBigNumber = amountBigNumber.plus(fee);
        }

        if (!this.networkWallet.subWallets[this.subWalletId].isBalanceEnough(amountBigNumber)) {
          this.conditionalShowToast('wallet.insufficient-balance', showToast);
          return false;
        }

        // Not using inscription utxo if not max clicked
        // if (!(await this.showConfirmIfNeedUseInscriptionUtxos(amountBigNumber))) {
        //     return false;
        // }

        if (!this.networkWallet.subWallets[this.subWalletId].isAmountValid(amountBigNumber)) {
          this.conditionalShowToast('wallet.amount-invalid', showToast);
          return false;
        }
      } else {
        // the fee is main token
        if (fee && !this.networkWallet.getMainTokenSubWallet().isBalanceEnough(fee)) {
          const message = this.translate.instant('wallet.eth-insuff-balance', {
            coinName: this.networkWallet.getDisplayTokenName()
          });
          this.conditionalShowToast(message, showToast, 4000);
          return false;
        }

        let balance = this.fromSubWallet.getBalance();
        if (balance.isZero()) {
          this.conditionalShowToast('wallet.amount-invalid', showToast);
          return false;
        }

        // if (!(await this.showConfirmIfNeedUseInscriptionUtxos(null))) {
        //     return false;
        // }
      }
    }

    if (fee && fee.gt(0) && !(this.fromSubWallet instanceof MainCoinSubWallet)) {
      // Balance can cover fee?
      if (!this.networkWallet.getMainTokenSubWallet().isBalanceEnough(fee)) {
        const message = this.translate.instant('wallet.eth-insuff-balance', {
          coinName: this.networkWallet.getDisplayTokenName()
        });
        this.conditionalShowToast(message, showToast, 4000);
        return false;
      }
    }

    if (this.transferType === TransferType.WITHDRAW) {
      if (!this.sendMax && this.amount < 0.0002) return false; // TODO: toast

      // Condition: amountWEI % 10000000000 == 0 (the unit is WEI)
      const amountString = this.amount.toString();
      const dotIndex = amountString.indexOf('.');
      if (dotIndex + 9 < amountString.length) {
        return false; // TODO: toast
      }
    }

    return true;
  }

  private isAddressValid(toAddress: string) {
    if (this.transferType === TransferType.RECHARGE) {
      if (!this.toSubWallet) {
        return WalletUtil.isEVMAddress(toAddress);
      }
    }
    let targetSubwallet = this.toSubWallet ? this.toSubWallet : this.fromSubWallet;
    return targetSubwallet.isAddressValid(toAddress);
  }

  async startTransaction() {
    // Specific case for ELA mainchain. TODO: should move to ela mainchain subwallet?
    if (this.subWalletId === StandardCoinName.ELA) {
      const mainAndIDChainSubWallet = this.networkWallet.subWallets[this.subWalletId] as MainChainSubWallet;
      const isAvailableBalanceEnough = await mainAndIDChainSubWallet.isAvailableBalanceEnough(
        new BigNumber(this.amount).multipliedBy(mainAndIDChainSubWallet.tokenAmountMulipleTimes)
      );

      if (!isAvailableBalanceEnough) {
        await this.native.toast_trans('wallet.transaction-pending');
        return;
      }
    }

    try {
      const index = this.toAddress.indexOf(':');
      if (index !== -1) {
        this.toAddress = this.toAddress.substring(index + 1);
      }

      const isAddressValid = await this.isAddressValid(this.toAddress);
      if (!isAddressValid) {
        this.native.toast_trans('wallet.not-a-valid-address');
        return;
      }

      if (this.transferType === TransferType.PAY) {
        await this.transaction();
      } else {
        if (this.transferType == TransferType.SEND_NFT) {
          // BPoS NFT need call approve
          if (this.coinTransferService.nftTransfer.needApprove) {
            this.navigateHomeAfterCompletion = false;
            // approve
            let ret = await this.approveNFT(this.toAddress);
            this.navigateHomeAfterCompletion = true;
            if (!ret) return;
          }
        } else if (this.transferType == TransferType.WITHDRAW) {
          if (this.networkWallet.network instanceof ElastosPGPNetworkBase) {
              await this.approveSpendingIfNeeded(this.fromSubWallet.getCurrentReceiverAddress())
          }
        }
        void this.showConfirm();
      }
    } catch (error) {
      Logger.error('wallet', "Can't start transaction in coin transfer page:", error);
      this.native.toast_trans('wallet.not-a-valid-address');
    }
  }

  private async parseException(err) {
    Logger.error('wallet', 'transaction error:', err);
    let reworkedEx = WalletExceptionHelper.reworkedWeb3Exception(err);
    if (reworkedEx instanceof Web3Exception) {
      await this.globalPopupService.ionicAlert('wallet.transaction-fail', 'common.network-or-server-error');
    } else {
      reworkedEx = WalletExceptionHelper.reworkedWalletTransactionException(err);
      if (reworkedEx instanceof WalletPendingTransactionException) {
        await this.globalPopupService.ionicAlert('common.warning', 'wallet.transaction-pending', 'common.understood');
      } else {
        let message: string = typeof err === 'string' ? err : err.message;
        if (message.includes('Cannot transfer TRX to the same account')) {
          message = 'wallet.transaction-same-account';
        }
        await this.globalPopupService.ionicAlert('wallet.transaction-fail', message);
      }
    }
  }

  private getFromTitle() {
    if (this.fromSubWallet.getAddressCount() == 1) {
      return this.fromSubWallet.getCurrentReceiverAddress();
    } else {
      // Only the ela main chain wallet may be a multi-address wallet.
      return StandardCoinName.ELA;
    }
  }

  async showConfirm() {
    let feeString = null;
    // ELA main chain
    if (this.feeOfELA) {
      let nativeFee = this.feeOfELA + ' ' + WalletNetworkService.instance.activeNetwork.value.getMainTokenSymbol();
      let currencyFee =
        this.fromSubWallet.getAmountInExternalCurrency(new BigNumber(this.feeOfELA)).toString() +
        ' ' +
        CurrencyService.instance.selectedCurrency.symbol;
      feeString = `${nativeFee} (~ ${currencyFee})`;
    }

    if (this.feeOfBTC) {
      let fee = new BigNumber(this.feeOfBTC).dividedBy(this.fromSubWallet.tokenAmountMulipleTimes);
      let nativeFee =
        WalletUtil.getAmountWithoutScientificNotation(fee, 8) +
        ' ' +
        WalletNetworkService.instance.activeNetwork.value.getMainTokenSymbol();
      let currencyFee =
        this.fromSubWallet.getAmountInExternalCurrency(fee).toString() +
        ' ' +
        CurrencyService.instance.selectedCurrency.symbol;
      feeString = `${nativeFee} (~ ${currencyFee})`;
    }

    if (this.feeOfTRX) {
      let nativeFee = this.feeOfTRX + ' ' + WalletNetworkService.instance.activeNetwork.value.getMainTokenSymbol();
      let mainTokenSubWallet = this.networkWallet.getMainTokenSubWallet();
      let currencyFee =
        mainTokenSubWallet.getAmountInExternalCurrency(new BigNumber(this.feeOfTRX)).toString() +
        ' ' +
        CurrencyService.instance.selectedCurrency.symbol;
      feeString = `${nativeFee} (~ ${currencyFee})`;
    }

    // SCR-016: fiat equivalent shown under the confirm amount hero.
    let amountFiat = null;
    let confirmedAmount =
      this.amount == -1 ? this.networkWallet.subWallets[this.subWalletId].getDisplayBalance() : new BigNumber(this.amount);
    let coinFiatPrice = this.getCoinFiatPrice();
    if (coinFiatPrice && coinFiatPrice.gt(0) && confirmedAmount && confirmedAmount.gte(0)) {
      amountFiat = formatFiatAmount(
        confirmedAmount.multipliedBy(coinFiatPrice).toNumber(),
        CurrencyService.instance.selectedCurrency.symbol
      );
    }

    const txInfo = {
      type: this.transferType,
      transferFrom: this.getFromTitle(),
      transferTo: this.toAddress,
      toChainId: this.transferType === TransferType.RECHARGE ? this.coinTransferService.toSubWalletId : null,
      amount: this.amount == -1 ? this.networkWallet.subWallets[this.subWalletId].getDisplayBalance() : this.amount,
      sendAll: this.amount == -1 ? true : false,
      precision: this.fromSubWallet.tokenDecimals,
      memo: this.memo ? this.memo : null,
      tokensymbol: this.tokensymbol,
      fee: feeString,
      gasLimit: this.gasLimit,
      coinType: this.fromSubWallet.type,
      // SCR-017: network + resolved contact name rows ('- -' fallback handled in the sheet).
      networkName: WalletNetworkService.instance.activeNetwork.value.getEffectiveName(),
      addressName: this.addressName,
      // SCR-016: fiat value beneath the amount hero.
      amountFiat: amountFiat
    };

    this.native.popup = await this.native.popoverCtrl.create({
      mode: 'ios',
      cssClass: 'wallet-tx-component',
      component: TxConfirmComponent,
      componentProps: {
        txInfo: txInfo
      }
    });
    this.native.popup.onWillDismiss().then(params => {
      this.native.popup = null;
      Logger.log('wallet', 'Confirm tx params', params);
      if (params.data && params.data.confirm) {
        if (params.data.gasPrice) this.gasPrice = params.data.gasPrice;
        if (params.data.gasLimit) this.gasLimit = params.data.gasLimit;
        void this.transaction();
      }
    });

    // Wait for the keyboard to close if needed, otherwise the popup is not centered.
    await sleep(500);

    return await this.native.popup.present();
  }

  async showSuccess() {
    this.native.popup = await this.native.popoverCtrl.create({
      mode: 'ios',
      cssClass: 'wallet-tx-component',
      component: TxSuccessComponent
    });
    this.native.popup.onWillDismiss().then(() => {
      this.native.popup = null;
    });
    return await this.native.popup.present();
  }

  // Pay intent
  async cancelPayment() {
    this.alreadySentIntentResponse = true;
    await this.globalIntentService.sendIntentResponse(
      { txid: null, status: 'cancelled' },
      this.coinTransferService.intentTransfer.intentId
    );
  }

  /**
   * Callback called whenever the "send to" address changes.
   * At that time, we cantry to call some APIs to retrieve an address by
   */
  async onSendToAddressInput(enteredText: string) {
    this.suggestedAddresses = [];
    this.addressName = null;
    // Typing always clears the inline error until the new value is re-checked.
    this.toAddressInvalid = false;

    if (!enteredText) {
      return;
    }

    // Cryptoname
    if (enteredText.length >= 3) {
      // Quick and dirty way to not try to resolve a name when it's actually an address already, not name.
      if (enteredText.length > 30) {
        let addressValid = await this.isAddressValid(enteredText);
        // Address-length input that fails the network check: surface it inline right away
        // (super-wallet pattern) instead of waiting for the Continue tap.
        this.toAddressInvalid = !addressValid;
        if (addressValid) return;
      }

      if (this.resolverNameTimeout) {
        clearTimeout(this.resolverNameTimeout);
      }
      this.resolverNameTimeout = setTimeout(() => {
        this.resolverName(enteredText);
      }, 800);
    }
  }

  private resolverName(name: string) {
    let targetSubwallet = null;
    if (this.transferType !== TransferType.RECHARGE) {
      targetSubwallet = this.toSubWallet ? this.toSubWallet : this.fromSubWallet;
    }
    // eslint-disable-next-line no-async-foreach/no-async-foreach, @typescript-eslint/no-misused-promises
    this.nameResolvingService.getResolvers().forEach(async resolver => {
      // resolvers can answer at any time, asynchronously
      const results = await resolver.resolve(name, targetSubwallet); // Use fromSubWallet just to know the network (toSubWallet is not always set)
      Logger.log('wallet', 'Name resolver got results from', resolver.getName(), results);
      this.suggestedAddresses = this.suggestedAddresses.concat(results);

      if (this.suggestedAddresses.length > 0) {
        // Scroll screen to bottom to let the suggested resolved name appear on screen
        void this.contentArea.scrollToBottom(500);
      }
    });
  }

  /**
   * A suggested resolved address is picked by the user. Replace user's input (ex: the user friendly name)
   * with its real address.
   */
  async selectSuggestedAddress(suggestedAddress: CryptoAddressResolvers.CryptoNameAddress): Promise<void> {
    this.toAddress = suggestedAddress.address;
    // this.addressName = suggestedAddress.getDisplayName();
    this.addressName = suggestedAddress.name;

    // Hide/reset suggestions
    this.suggestedAddresses = [];
    await this.contactsService.addContact(suggestedAddress);

    this.setCryptonamesKeyVisibility(true);
  }

  isStandardSubwallet(subWallet: AnySubWallet) {
    return subWallet instanceof MainCoinSubWallet;
  }

  convertAmountToBigNumber(amount: number) {
    return new BigNumber(amount);
  }

  async showCryptonames() {
    let targetSubwallet = null;
    if (this.transferType !== TransferType.RECHARGE) {
      targetSubwallet = this.toSubWallet ? this.toSubWallet : this.fromSubWallet;
    }
    this.modal = await this.modalCtrl.create({
      component: ContactsComponent,
      componentProps: {
        subWallet: targetSubwallet
      },
      // SCR-005: present the contacts picker as a bottom sheet on the shared sheet skin.
      breakpoints: [0, 0.55],
      initialBreakpoint: 0.55,
      handle: true,
      cssClass: 'contacts-sheet-modal'
    });
    this.modal.onWillDismiss().then(params => {
      Logger.log('wallet', 'Contact selected', params);
      if (params.data && params.data.contact) {
        this.addressName = params.data.contact.cryptoname;
        this.toAddress = params.data.contact.address;
      }

      this.modal = null;
    });
    this.modal.present();
  }

  // Intent response will return a contact's DID document under result.friends.document
  async openContacts() {
    let res = await this.globalIntentService.sendIntent('https://contact.web3essentials.io/pickfriend', {
      singleSelection: true,
      filter: {
        credentialType: 'elaAddress'
      }
    });
    if (res.result.friends && res.result.friends[0]) {
      this.zone.run(() => {
        this.toAddress = res.result.friends[0].credentials.elaAddress;
        this.addressName = res.result.friends[0].credentials.name;
      });
    }
  }

  getResidual(balance: BigNumber) {
    if (this.amount) {
      return balance.minus(this.amount);
    } else {
      return balance;
    }
  }

  isPositiveResidual(balance: BigNumber) {
    if (this.amount) {
      const residual = balance.minus(this.amount);
      if (residual.isGreaterThanOrEqualTo(0)) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  }

  getButtonLabel(): string {
    switch (this.transferType) {
      case TransferType.RECHARGE:
        return 'wallet.recharge';
      case TransferType.SEND:
        return 'wallet.send';
      case TransferType.PAY:
        return 'wallet.pay';
      case TransferType.WITHDRAW:
        return 'wallet.withdraw';
      default:
        return 'wallet.send';
    }
  }

  /** A plain Send shows "Send {coin}" (2026 design); other transfer types keep their label. */
  buttonTitle(): string {
    if (this.transferType === TransferType.SEND && this.fromSubWallet) {
      return this.translate.instant('wallet.send-coin', { coin: this.fromSubWallet.getDisplayTokenName() });
    }
    return this.translate.instant(this.getButtonLabel());
  }

  showKeyboard() {
    this.keyboard.show();
  }

  hideKeyboard() {
    this.keyboard.hide();
  }

  keyboardIsVisible() {
    return this.keyboard.isVisible;
  }

  /**
   * Tells whether the transfer can be sent to another of user's existing wallets.
   * Typically, this returns true if there are more than one wallet created in the app.
   */
  canSendToPersonalWallet(): boolean {
    return this.walletManager.getMasterWalletsCount() > 1;
  }

  /**
   * Opens a wallet chooser, optionally with excluding the current wallet.
   */
  async choosePersonalWallet(excludeCurrentWallet = false) {
    let options: WalletChooserComponentOptions = {
      sourceWallet: this.networkWallet,
      subWalletId: this.subWalletId
    };

    if (excludeCurrentWallet) {
      options.excludeWalletId = this.networkWallet.id;
    }

    this.modal = await this.modalCtrl.create({
      component: TransferWalletChooserComponent,
      componentProps: options
    });
    this.modal.onWillDismiss().then(async params => {
      Logger.log('wallet', 'Personal wallet selected:', params);
      if (params.data && params.data.selectedWalletId) {
        let selectedWallet = this.walletManager.getNetworkWalletFromMasterWalletId(params.data.selectedWalletId);
        let selectedSubwallet = selectedWallet.getSubWallet(this.subWalletId);
        if (!selectedSubwallet) {
          // Subwallet doesn't exist on target master wallet. So we activate it.
          let coin = (<EVMNetwork>this.networkWallet.network).getCoinByID(this.subWalletId);
          await selectedWallet.createNonStandardSubWallet(coin);
          selectedSubwallet = selectedWallet.getSubWallet(this.subWalletId);
        }

        this.toAddress = await selectedSubwallet.getCurrentReceiverAddress(AddressUsage.SEND_FUNDS);
      }

      this.modal = null;
    });
    this.modal.present();
  }

  // for elastos cross chain transaction.
  getELANetworkByID(id: StandardCoinName) {
    let networkKey = 'elastos';
      switch (id) {
        case StandardCoinName.ETHDID:
          networkKey = 'elastosidchain';
          break;
        case StandardCoinName.ETHSC:
          networkKey = 'elastossmartchain';
          break;
        case StandardCoinName.ETHECOPGP:
          networkKey = 'elastosecopgp';
          break;
        default:
          break;
    }
    return WalletNetworkService.instance.getNetworkByKey(networkKey);
  }

  async getELASubwalletByID(id: StandardCoinName) {
    let network = this.getELANetworkByID(id);
    let networkWallet = await network.createNetworkWallet(this.networkWallet.masterWallet, false);
    if (!networkWallet) {
      return null; // eg. Multi signature wallet does not support EVM chain.
    }

    if (id === StandardCoinName.ETHECOPGP) {
      // The ela token is erc20 token on pgp sidechain. Cross chain transactions require a chain ID.
      let elaTokenAddress = (networkWallet.network as ElastosPGPNetworkBase).getELATokenContract();
      return networkWallet.getSubWallet(elaTokenAddress);
    } else {
      return networkWallet.getSubWallet(id);
    }
  }

  public isTransferTypeSendNFT(): boolean {
    return this.transferType === TransferType.SEND_NFT;
  }

  public getDisplayableAssetName(): string {
    return this.nftAsset.name || this.translate.instant('wallet.nft-unnamed-asset');
  }

  public getDisplayableAssetID(): string {
    return this.nftAsset.displayableId;
  }

  public hasRealAssetIcon(): boolean {
    return !!this.nftAsset.imageURL;
  }

  public getAssetIcon(): string {
    if (this.hasRealAssetIcon()) return this.nftAsset.imageURL;
    else return 'assets/wallet/coins/eth-purple.svg';
  }

  /**
   * We show a warning to usersto make sure they don't send ESC ELA to coinbase.
   * Both use EVM addresses, but coinbase uses the wrapped ethereum ELA, so sending ESC ELA
   * to coinbase would make the funds lost.
   *
   * This warning is shown if:
   * - network is ESC
   * - sending coin is ELA
   * - transfer type is SEND
   */
  public shouldShowCoinbaseELAWarning(): boolean {
    // Network should be ESC
    if (!this.networkWallet || this.networkWallet.network.key !== ElastosSmartChainNetworkBase.NETWORK_KEY)
      return false;

    if (!this.fromSubWallet || this.fromSubWallet.id !== StandardCoinName.ETHSC) return false;

    if (this.transferType !== TransferType.SEND) return false;

    return true;
  }

  /**
   * We show a warning to usersto make sure they don't send EID ELA to esc or other chains.
   *
   * This warning is shown if:
   * - network is EID
   * - sending coin is ELA
   * - transfer type is SEND
   */
  public shouldShowEIDELAWarning(): boolean {
    // Network should be EID
    if (!this.networkWallet || this.networkWallet.network.key !== ElastosIdentityChainNetworkBase.NETWORK_KEY)
      return false;

    if (!this.fromSubWallet || this.fromSubWallet.id !== StandardCoinName.ETHDID) return false;

    if (this.transferType !== TransferType.SEND) return false;

    return true;
  }

  /*
   * User can set the custum receiver address for chross chain transfer.
   */
  public enableCustumReceiverAddress() {
    this.zone.run(() => {
      this.useCustumReceiverAddress = !this.useCustumReceiverAddress;
      // Reset toAddress
      if (!this.useCustumReceiverAddress) {
        this.toAddress = this.toSubWallet.getCurrentReceiverAddress();
      }
    });
  }

  // For Btc: select fee rate
  private async getAllBTCFeerate() {
    try {
      let fast = await GlobalBTCRPCService.instance.estimatesmartfee(
        (<BTCSubWallet>this.fromSubWallet).networkWallet.network.getSelectedRpcUrl(),
        BTCFeeSpeed.FAST
      );
      this.btcFeerates[BTCFeeSpeed.FAST] = Util.accMul(fast, Config.SATOSHI) / 1000;
      let avg = await GlobalBTCRPCService.instance.estimatesmartfee(
        (<BTCSubWallet>this.fromSubWallet).networkWallet.network.getSelectedRpcUrl(),
        BTCFeeSpeed.AVERAGE
      );
      this.btcFeerates[BTCFeeSpeed.AVERAGE] = Util.accMul(avg, Config.SATOSHI) / 1000;
      let slow = await GlobalBTCRPCService.instance.estimatesmartfee(
        (<BTCSubWallet>this.fromSubWallet).networkWallet.network.getSelectedRpcUrl(),
        BTCFeeSpeed.SLOW
      );
      this.btcFeerates[BTCFeeSpeed.SLOW] = Util.accMul(slow, Config.SATOSHI) / 1000;
    } catch (e) {
      Logger.warn('wallet', ' estimatesmartfee error', e);
    }
  }

  public shouldShowPickBTCFeerate(): boolean {
    if (this.fromSubWallet instanceof BTCSubWallet) return true;

    return false;
  }

  private setBTCFeerate(feerate: BTCFeeSpeed) {
    this.btcFeerateUsed = feerate;
  }

  private buildBTCFeerateMenuItems(): MenuSheetMenu[] {
    return [
      {
        title: this.getBtcFeerateTitle(BTCFeeSpeed.FAST),
        subtitle: this.btcFeerates[BTCFeeSpeed.FAST] + ' sat/vB',
        routeOrAction: () => {
          void this.setBTCFeerate(BTCFeeSpeed.FAST);
        }
      },
      {
        title: this.getBtcFeerateTitle(BTCFeeSpeed.AVERAGE),
        subtitle: this.btcFeerates[BTCFeeSpeed.AVERAGE] + ' sat/vB',
        routeOrAction: () => {
          void this.setBTCFeerate(BTCFeeSpeed.AVERAGE);
        }
      },
      {
        title: this.getBtcFeerateTitle(BTCFeeSpeed.SLOW),
        subtitle: this.btcFeerates[BTCFeeSpeed.SLOW] + ' sat/vB',
        routeOrAction: () => {
          void this.setBTCFeerate(BTCFeeSpeed.SLOW);
        }
      },
      {
        title: GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-custom'),
        subtitle: this.customBtcFeerate ? this.customBtcFeerate + ' sat/vB' : '',
        routeOrAction: () => {
          void this.showCustomFeerateInput();
        }
      }
    ];
  }

  /**
   * Choose an fee rate
   */
  public async pickBTCFeerate() {
    if (this.isShowingBTCFeerateMenu) return;

    this.isShowingBTCFeerateMenu = true;
    try {
      if (!this.btcFeerates[BTCFeeSpeed.SLOW]) {
        await this.getAllBTCFeerate();
        if (!this.btcFeerates[BTCFeeSpeed.SLOW]) {
          Logger.warn('wallet', 'Can not get the btc fee rate.');
          return;
        }
      }

      let menuItems: MenuSheetMenu[] = this.buildBTCFeerateMenuItems();

      let menu: MenuSheetMenu = {
        title: GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-select-title'),
        items: menuItems
      };

      await GlobalNativeService.instance.showGenericBottomSheetMenuChooser(menu);
    } finally {
      this.isShowingBTCFeerateMenu = false;
    }
  }

  public getBtcFeerateTitle(btcFeerate) {
    switch (btcFeerate) {
      case BTCFeeSpeed.AVERAGE:
        return GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-avg');
      case BTCFeeSpeed.SLOW:
        return GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-slow');
      case BTCFeeSpeed.CUSTOM:
        return GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-custom');
      default: // BTCFeeRate.Fast
        return GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-fast');
    }
  }

  public getCurrenttBtcFeerateTitle() {
    if (this.btcFeerateUsed === BTCFeeSpeed.CUSTOM && this.customBtcFeerate) {
      return `${this.getBtcFeerateTitle(this.btcFeerateUsed)} (${this.customBtcFeerate} sat/vB)`;
    }
    return this.getBtcFeerateTitle(this.btcFeerateUsed);
  }

  /**
   * Show a dialog for user to input custom fee rate
   */
  private async showCustomFeerateInput() {
    const alert = await this.alertCtrl.create({
      mode: 'ios',
      header: GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-custom-input-title'),
      message: GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-custom-input-message'),
      inputs: [
        {
          name: 'feerate',
          type: 'number',
          placeholder: GlobalTranslationService.instance.translateInstant('wallet.btc-feerate-custom-input-placeholder'),
          value: this.customBtcFeerate || '',
          min: 1
        }
      ],
      buttons: [
        {
          text: GlobalTranslationService.instance.translateInstant('common.cancel'),
          role: 'cancel'
        },
        {
          text: GlobalTranslationService.instance.translateInstant('common.confirm'),
          handler: (data) => {
            const feerate = parseFloat(data.feerate);
            if (feerate && feerate > 0) {
              // Check if the fee rate is too low
              const slowFeerate = this.btcFeerates[BTCFeeSpeed.SLOW] || 1;
              if (feerate < slowFeerate) {
                // Show warning for low fee rate
                void this.showLowFeerateWarning(feerate);
              } else {
                this.customBtcFeerate = feerate;
                this.btcFeerateUsed = BTCFeeSpeed.CUSTOM;
                Logger.log('wallet', 'Custom BTC fee rate set to:', this.customBtcFeerate, 'sat/vB');
              }
            } else {
              this.native.toast_trans('wallet.btc-feerate-custom-input-invalid');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Show a warning dialog when the custom fee rate is too low
   */
  private async showLowFeerateWarning(feerate: number) {
    const slowFeerate = this.btcFeerates[BTCFeeSpeed.SLOW] || 1;
    const confirmed = await this.globalPopupService.ionicConfirm(
      'wallet.btc-feerate-low-warning-title',
      this.translate.instant('wallet.btc-feerate-low-warning-message', {
        feerate: feerate,
        slowFeerate: slowFeerate
      }),
      'common.confirm',
      'common.cancel'
    );

    if (confirmed) {
      this.customBtcFeerate = feerate;
      this.btcFeerateUsed = BTCFeeSpeed.CUSTOM;
      Logger.log('wallet', 'Custom BTC fee rate set to (low):', this.customBtcFeerate, 'sat/vB');
    }
  }

  // public async showConfirmIfNeedUseInscriptionUtxos(amount: BigNumber) {
  //     if (!(this.fromSubWallet instanceof BTCSubWallet)) {
  //         return true;
  //     }

  //     if (this.inscriptionUtxoBalanceSATOnBTC.isZero())
  //         return true;

  //     if ((amount == null) || (!this.fromSubWallet.isBalanceEnough(amount.plus(satsToBtc(this.inscriptionUtxoBalanceSATOnBTC))))) {
  //         let noteMessage = this.translate.instant('wallet.btc-inscription-utxos-info', { utxos: this.inscriptionUtxoBalanceOnBTCString });
  //         let result = await this.globalPopupService.ionicConfirm('wallet.btc-inscription-utxos-title', noteMessage, "common.continue")
  //         this.useInscriptionUTXO = result;
  //         return result;
  //     }

  //     return true;
  // }

  public async estimateBTCFees() {
    // Calculate fee after input amount
    let amountBigNumber = new BigNumber(this.amount || 0);
    // For custom fee rate, convert sat/vB to sat/kB
    let forcedSatPerKB = null;
    if (this.btcFeerateUsed === BTCFeeSpeed.CUSTOM && this.customBtcFeerate) {
      forcedSatPerKB = this.customBtcFeerate * 1000;
    }
    try {
      this.feeOfBTC = (
        await (<BTCSubWallet>this.fromSubWallet).estimateTransferTransactionGas(
          this.btcFeerateUsed,
          forcedSatPerKB,
          amountBigNumber,
          this.useInscriptionUTXO
        )
      ).toString();
      return true;
    } catch (e) {
      let stringifiedError = '' + e;
      let message = 'Failed to estimate fee';
      if (stringifiedError.indexOf('Utxo is not enough') >= 0) {
        message = 'wallet.insufficient-balance';

        // if (this.inscriptionUtxoBalanceSATOnBTC.isPositive() && this.useInscriptionUTXO) {
        //     let result = await this.showConfirmIfNeedUseInscriptionUtxos(amountBigNumber)
        //     if (result) {
        //         this.useInscriptionUTXO = true;
        //         // Use inscriotion utxo to re-estimate
        //         return await this.estimateBTCFees();
        //     }
        // }
      }
      this.conditionalShowToast(message, true);
      return false;
    }
  }

  // BPoS NFT need call approve.
  async approveNFT(targetAddress: string) {
    let methodData = await this.erc721service.approve(this.nft.contractAddress, targetAddress, this.nftAsset.id);

    await this.native.hideLoading();

    if (methodData) {
      this.coinTransferService.masterWalletId = this.networkWallet.id;
      this.coinTransferService.payloadParam = {
        data: methodData,
        to: this.nft.contractAddress
      };

      void this.native.go('/wallet/intents/esctransaction', { intentMode: false });

      return new Promise<boolean>(resolve => {
        let approveSubscription: Subscription = this.events.subscribe('esctransaction', ret => {
          approveSubscription.unsubscribe();
          if (ret.result.published) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    }

    return true;
  }

  /**
   * The ELA on the PGP chain is an ERC20 token, and approval is required for withdrawal
   */
  private async approveSpendingIfNeeded(targetAddress: string): Promise<boolean> {
      let mainCoinSubWallet = this.networkWallet.getMainEvmSubWallet();
      // Raw on-chain amount is value * 10^decimals (tokenAmountMulipleTimes), NOT
      // value * decimals. The old code multiplied by the decimal COUNT, approving a
      // wildly wrong allowance. Match every other raw-unit conversion in this file.
      let amount = new BigNumber(this.amount).multipliedBy(this.fromSubWallet.tokenAmountMulipleTimes)
      return await this.erc20CoinService.approveSpendingIfNeeded(mainCoinSubWallet, this.fromSubWallet.id, this.fromSubWallet.tokenDecimals, targetAddress, amount);
  }
}
