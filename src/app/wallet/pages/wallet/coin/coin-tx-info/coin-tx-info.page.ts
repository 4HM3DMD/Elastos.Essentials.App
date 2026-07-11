import { Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import type { VotesContentInfo } from '@elastosfoundation/wallet-js-sdk';
import { RenewalVotesContentInfo } from '@elastosfoundation/wallet-js-sdk/typings/transactions/payload/Voting';
import { TranslateService } from '@ngx-translate/core';
import { BigNumber } from 'bignumber.js';
import moment from 'moment';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { TitleBarIcon, TitleBarMenuItem } from 'src/app/components/titlebar/titlebar.types';
import { DappBrowserService } from 'src/app/dappbrowser/services/dappbrowser.service';
import { Logger } from 'src/app/logger';
import { Util } from 'src/app/model/util';
import { GlobalElastosAPIService, NodeType } from 'src/app/services/global.elastosapi.service';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalTranslationService } from 'src/app/services/global.translation.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { VoteType } from 'src/app/voting/staking/services/stake.service';
import { Config } from 'src/app/wallet/config/Config';
import { ExtendedTransactionInfo } from 'src/app/wallet/model/extendedtxinfo';
import { AnyNetworkWallet } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { ElastosMainChainStandardNetworkWallet } from 'src/app/wallet/model/networks/elastos/mainchain/networkwallets/standard/mainchain.networkwallet';
import { MainChainSubWallet } from 'src/app/wallet/model/networks/elastos/mainchain/subwallets/mainchain.subwallet';
import { ETHOperationType } from 'src/app/wallet/model/networks/evms/ethtransactioninfoparser';

import { InscriptionUtil } from 'src/app/wallet/model/inscription';

import { EthTransaction } from 'src/app/wallet/model/networks/evms/evm.types';
import { AddressUsage } from 'src/app/wallet/model/safes/addressusage';
import { WalletUtil } from 'src/app/wallet/model/wallet.util';
import { CurrencyService } from 'src/app/wallet/services/currency.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { OfflineTransactionsService } from 'src/app/wallet/services/offlinetransactions.service';
import { StandardCoinName } from '../../../../model/coin';
import { AnySubWallet } from '../../../../model/networks/base/subwallets/subwallet';
import { ElastosEVMSubWallet } from '../../../../model/networks/elastos/evms/subwallets/standard/elastos.evm.subwallet';
import {
  AnyOfflineTransaction,
  TransactionDirection,
  TransactionInfo,
  TransactionInfoType,
  TransactionType
} from '../../../../model/tx-providers/transaction.types';
import { ContactsService } from 'src/app/wallet/services/contacts.service';
import { Native } from '../../../../services/native.service';
import { WalletService } from '../../../../services/wallet.service';

export type CoinTxInfoParams = {
  masterWalletId: string;
  subWalletId: string;
  offlineTransaction?: AnyOfflineTransaction; // If unpublished
  transactionInfo?: TransactionInfo; // If published
};

class TransactionDetail {
  type: TransactionInfoType;
  title: string;
  value: any = null;
  show: boolean;
}

enum ValueType {
  Normal = 1,
  StringArray = 2,
  Votes = 3
}

@Component({
  selector: 'app-coin-tx-info',
  templateUrl: './coin-tx-info.page.html',
  styleUrls: ['./coin-tx-info.page.scss']
})
export class CoinTxInfoPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

  // General Values
  private networkWallet: AnyNetworkWallet = null;
  public subWallet: AnySubWallet = null;
  public transactionInfo: TransactionInfo = null;
  private extendedTxInfo: ExtendedTransactionInfo = null;
  public offlineTransaction: AnyOfflineTransaction = null;

  private mainTokenSymbol = '';

  // Header Display Values
  public type: TransactionType;
  public payStatusIcon = '';
  public direction = '';
  public symbol = '';
  public amount: BigNumber;
  public displayAmount = '';
  public status = '';
  public statusName = '';
  // Figma hero display values (SYS-005 coin disc, SYS-021 toned amount + ticker)
  public heroIcon = '';
  public heroSign = '';
  public heroAmount = '';
  // Real token ticker (e.g. "ELA"). transactionInfo.symbol is only a +/- SIGN, not a
  // ticker, so it must never be shown as one (heroSign carries the sign separately).
  public ticker = '';
  public amountTone: 'success' | 'danger' | 'neutral' = 'neutral';
  public memo = '';
  public height = 0;
  // Show the transfer transacton amount, eg. amount for unstake and DPoS voting.
  public transferAmount: string;
  public dpos2Votes = [];
  public dpos2UpdateVotes = [];
  public crProposalVotes = [];
  public crcImpeachmentVotes = [];
  public crCouncilVotes = [];
  private isUnvoteTx = false;

  // Other Values
  public payFee: string = null;
  public targetAddress = null;
  public fromAddress = null;
  public isRedPacket = false;

  // Show the ERC20 Token detail in ETHSC transaction.
  public isERC20TokenTransactionInETHSC = false;
  public tokenName = '';
  public contractAddress = '';
  public tokenAmount = '';

  // List of displayable transaction details
  public txDetails: TransactionDetail[] = [];
  // False until the awaited details fetch has built the rows; the details card
  // shows a kv-shaped skeleton meanwhile instead of a blank body.
  public detailsLoaded = false;

  public crossChainNetworkKey = null; // For cross chain transaction, we need to open address in target network explorer.

  constructor(
    public events: GlobalEvents,
    public router: Router,
    public walletManager: WalletService,
    public native: Native,
    private translate: TranslateService,
    public theme: GlobalThemeService,
    private offlineTransactionsService: OfflineTransactionsService,
    private nav: GlobalNavService,
    public dappbrowserService: DappBrowserService,
    private zone: NgZone,
    private contactsService: ContactsService
  ) {}

  ngOnInit() {
    // Always clear the details skeleton once init settles, success or failure -
    // a rejected details RPC must not leave the skeleton animating forever.
    void this.init()
      .catch(e => Logger.error('wallet', 'coin-tx-info init failed', e))
      .finally(() => { this.detailsLoaded = true; });
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.getNavTitle());

    if (this.offlineTransaction) {
      // If there is an offline transaction, we can show a delete menu
      this.titleBar.setupMenuItems([
        { key: 'delete', title: this.translate.instant('common.delete'), iconPath: 'assets/contacts/images/delete.svg' }
      ]);
      this.titleBar.setMenuVisibility(true);

      this.titleBar.addOnItemClickedListener(
        (this.titleBarIconClickedListener = icon => {
          if (icon.key === 'delete') {
            void this.deleteOfflineTransaction();
          }
        })
      );
    }
  }

  ionViewWillLeave() {
    this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
  }

  private async init() {
    this.mainTokenSymbol = WalletNetworkService.instance.activeNetwork.value.getMainTokenSymbol();

    const navigation = this.router.getCurrentNavigation();
    if (!Util.isEmptyObject(navigation.extras.state)) {
      // General Values
      let state = navigation.extras.state;

      this.networkWallet = this.walletManager.getNetworkWalletFromMasterWalletId(state.masterWalletId);

      let subWalletId = state.subWalletId;
      this.subWallet = this.networkWallet.getSubWallet(subWalletId);

      console.log('txinfo state', state);

      // We may receive either one or the other
      this.offlineTransaction = state.offlineTransaction;
      if (this.offlineTransaction)
        this.transactionInfo = await this.subWallet.getTransactionInfoForOfflineTransaction(this.offlineTransaction);
      else this.transactionInfo = state.transactionInfo;

      Logger.log('wallet', 'Tx info', this.transactionInfo);

      // Header display values
      this.type = this.transactionInfo.type;
      this.amount = this.transactionInfo.amount;
      this.symbol = this.transactionInfo.symbol;
      this.ticker = this.subWallet.getDisplayTokenName();
      this.status = this.transactionInfo.status;
      this.statusName = this.transactionInfo.statusName;
      this.payStatusIcon = this.transactionInfo.payStatusIcon;
      this.direction = this.transactionInfo.direction;
      this.memo = this.transactionInfo.memo;
      this.height = this.transactionInfo.height;
      this.targetAddress = this.transactionInfo.to;
      this.fromAddress = this.transactionInfo.from;

      // SYS-023: set the nav title now that direction/symbol are known.
      this.titleBar.setTitle(this.getNavTitle());

      // SYS-005 coin disc + SYS-021 hero amount (signed, 2 decimals, toned by direction).
      // LOGIC:wrong-icon — use the token's own icon (ERC20/TRC20 logo) with the network logo as a
      // fallback, matching the token-detail page. The bare network logo mislabelled token txs.
      this.heroIcon = this.subWallet.getMainIcon() || this.networkWallet.network.logo;
      if (this.type === TransactionType.RECEIVED) {
        this.heroSign = '+';
        this.amountTone = 'success';
      } else if (this.type === TransactionType.SENT) {
        this.heroSign = '-';
        this.amountTone = 'danger';
      } else {
        this.heroSign = '';
        this.amountTone = 'neutral';
      }
      // Full token precision, not toFixed(2) - rounding misrepresents crypto amounts
      // and contradicted the full-precision Amount row below.
      this.heroAmount = this.amount
        ? WalletUtil.getAmountWithoutScientificNotation(new BigNumber(this.amount).abs(), this.subWallet.tokenDecimals)
        : '0';
      this.payFee =
        this.transactionInfo.fee !== null
          ? WalletUtil.getAmountWithoutScientificNotation(new BigNumber(this.transactionInfo.fee), 8)
          : null;
      this.displayAmount =
        WalletUtil.getAmountWithoutScientificNotation(this.amount, this.subWallet.tokenDecimals) || '0';
      this.isRedPacket = this.transactionInfo.isRedPacket;
      this.transferAmount = this.transactionInfo.transferAmount
        ? WalletUtil.getAmountWithoutScientificNotation(
            this.transactionInfo.transferAmount,
            this.subWallet.tokenDecimals
          ) || '0'
        : null;
      if (this.transactionInfo.votesContents) {
        await this.getVoteInfo(this.transactionInfo.votesContents);
        this.isUnvoteTx =
          this.dpos2Votes.length == 0 &&
          this.crCouncilVotes.length == 0 &&
          this.crcImpeachmentVotes.length == 0 &&
          this.crProposalVotes.length == 0;
      }
      if (this.transactionInfo.renewalVotesContentInfo) {
        await this.getRenewalVotesContentInfo(this.transactionInfo.renewalVotesContentInfo);
      }

      let extTxInfo = await this.networkWallet.getExtendedTxInfo(this.transactionInfo.txid);
      this.extendedTxInfo = extTxInfo;
      if (this.extendedTxInfo?.evm?.txInfo?.type == ETHOperationType.INSCRIPTION) {
        void this.getInscriptionInfo(this.transactionInfo.txid);
      }

      if (this.extendedTxInfo?.evm?.txInfo?.type == ETHOperationType.WITHDRAW
          && this.extendedTxInfo?.evm?.txInfo?.operation?.descriptionTranslationParams?.toAddress) {
        this.targetAddress = this.extendedTxInfo?.evm?.txInfo?.operation?.descriptionTranslationParams?.toAddress;
      }

      // Await: this fetch fills confirmStatus (and the crosschain real address) that the
      // row builder below reads - fire-and-forget raced it and lost.
      await this.getTransactionDetails();
    }
    // detailsLoaded is set by ngOnInit's finally() so it is cleared on both the
    // success and failure paths (the details fetch is a full RPC round-trip).
  }

  async getTransactionDetails() {
    // TODO: To Improve
    if (this.subWallet.id === StandardCoinName.ELA) {
      const transaction = await (this.subWallet as MainChainSubWallet).getTransactionDetails(this.transactionInfo.txid);
      if (transaction) {
        this.transactionInfo.confirmStatus = transaction.confirmations;
        // If the fee is too small, then amount doesn't subtract fee
        // if (transaction.Fee > 10000000000) {
        //   this.amount = this.amount.minus(this.payFee);
        // }

        // Tx is ETH - Define amount, fee, total cost and address
        if (this.direction === TransactionDirection.SENT) {
          // Address: sender address or receiver address
          this.targetAddress = await (this.subWallet as MainChainSubWallet).getRealAddressInCrosschainTx(transaction);
        } else if (this.direction === TransactionDirection.RECEIVED) {
          // TODO: show all the inputs and outputs.
        }
      }
    } else {
      // TODO: There is no txid in internal transaction, use transactionHash and get more info?
      if (this.transactionInfo.txid) {
        // Address
        if (this.subWallet.id === StandardCoinName.ETHSC || this.subWallet.id === StandardCoinName.ETHDID) {
          const transaction = await (this.subWallet as ElastosEVMSubWallet).getTransactionDetails(
            this.transactionInfo.txid
          );
          if (this.direction === TransactionDirection.SENT) {
            this.targetAddress = await this.getETHSCTransactionTargetAddres(transaction);
          } else if (this.direction === TransactionDirection.RECEIVED) {
            if (this.transactionInfo.isCrossChain === true) {
              // TODO: We can't get the real address for cross chain transafer.
              this.fromAddress = null;
            }
          }
        }
      }
    }

    if (this.transactionInfo.isCrossChain === true) {
      if (this.transactionInfo.crossChainToAddress) {
        this.targetAddress = this.transactionInfo.crossChainToAddress;
      }

      this.crossChainNetworkKey = 'elastos';
    }

    // Create array of displayable details for txs
    this.txDetails = [];

    // Tx details valid only for published transactions
    if (!this.offlineTransaction) {
      this.txDetails.push({
        type: TransactionInfoType.TIME,
        title: 'wallet.tx-info-time',
        value:
          this.transactionInfo.timestamp === 0
            ? this.translate.instant('wallet.coin-transaction-status-pending')
            : moment(this.transactionInfo.timestamp).format('D MMM YYYY, hh:mm A'),
        show: true
      });

      // Confirmations: the trust signal for a settled transaction. Deep counts read as
      // "100+" - the exact figure past that point carries no extra meaning.
      if (this.transactionInfo.confirmStatus != null && this.transactionInfo.confirmStatus >= 0) {
        this.txDetails.push({
          type: TransactionInfoType.CONFIRMATIONS,
          title: 'wallet.tx-info-confirmations',
          value: this.transactionInfo.confirmStatus > 100 ? '100+' : String(this.transactionInfo.confirmStatus),
          show: true
        });
      }

      // SYS-024: Memo only when present.
      if (this.memo) {
        this.txDetails.push({
          type: TransactionInfoType.MEMO,
          title: 'wallet.tx-info-memo',
          value: this.memo,
          show: true
        });
      }

      // SYS-024: Confirmations and Block ID rows removed (not in Figma).
      this.txDetails.push({
        type: TransactionInfoType.TXID,
        title: 'wallet.tx-info-txid',
        value: this.transactionInfo.txid,
        show: false
      });
    }

    // Only show receiving address, total cost and fees if tx was not received
    if (this.direction !== TransactionDirection.RECEIVED) {
      // For ERC20 Token Transfer
      if (this.subWallet.id === StandardCoinName.ETHSC && this.transactionInfo.erc20TokenSymbol) {
        if (this.transactionInfo.erc20TokenValue) {
          this.txDetails.unshift({
            type: TransactionInfoType.AMOUNT,
            title: 'wallet.tx-info-erc20-amount',
            value: this.transactionInfo.erc20TokenValue,
            show: true
          });
        }

        if (this.transactionInfo.erc20TokenSymbol) {
          this.txDetails.unshift({
            type: TransactionInfoType.TOKENSYMBOL,
            title: 'wallet.erc-20-token',
            value: this.transactionInfo.erc20TokenSymbol,
            show: true
          });
        }

        if (this.transactionInfo.erc20TokenContractAddress) {
          this.txDetails.unshift({
            type: TransactionInfoType.CONTRACTADDRESS,
            title: 'wallet.tx-info-token-address',
            value: await this.networkWallet.convertAddressForUsage(
              this.transactionInfo.erc20TokenContractAddress,
              AddressUsage.DISPLAY_TRANSACTIONS
            ),
            show: true
          });
        }
      }

      if (this.transactionInfo.resources) {
        this.txDetails.unshift({
          type: TransactionInfoType.RESOURCES,
          title: 'wallet.tx-info-resource-consumed',
          value: this.transactionInfo.resources,
          show: true
        });
      }

      if (this.payFee !== null) {
        // SCR-107: the Network Fee row shows the native amount only ('0.0001 ELA'),
        // without the parenthetical fiat conversion.
        let nativeFee = this.payFee + ' ' + this.mainTokenSymbol;

        this.txDetails.unshift({
          type: TransactionInfoType.FEES,
          title: 'wallet.tx-info-network-fee',
          value: nativeFee,
          show: true
        });
      }

      // Explicit From -> To (super-wallet pattern): the recipient is To; the sender is
      // this wallet, shown with its own address so the transfer reads as a movement
      // between two named endpoints instead of one ambiguous "Address".
      if (this.targetAddress !== null) {
        this.txDetails.unshift({
          type: TransactionInfoType.ADDRESS,
          title: 'wallet.tx-info-to',
          value: this.transactionInfo.isCrossChain
            ? this.targetAddress
            : await this.networkWallet.convertAddressForUsage(this.targetAddress, AddressUsage.DISPLAY_TRANSACTIONS),
          show: true
        });
      }

      let sentFrom = this.fromAddress;
      if (!sentFrom || sentFrom === '0x0000000000000000000000000000000000000000') {
        try {
          sentFrom = await this.subWallet.getCurrentReceiverAddress();
        } catch (e) {
          sentFrom = null;
        }
      }
      if (sentFrom) {
        this.txDetails.unshift({
          type: TransactionInfoType.ADDRESS,
          title: 'wallet.tx-info-from',
          value: await this.networkWallet.convertAddressForUsage(sentFrom, AddressUsage.DISPLAY_TRANSACTIONS),
          show: true
        });
      }
    } else {
      // Receving or move transaction
      // Sending address
      // TODO: It is the transaction to create a token if the from address is "0x0000000000000000000000000000000000000000".
      if (this.fromAddress && this.fromAddress !== '0x0000000000000000000000000000000000000000') {
        // TODO: We should show all the inputs and outputs for ELA main chain.
        this.txDetails.unshift({
          type: TransactionInfoType.ADDRESS,
          title: 'wallet.tx-info-from',
          value: this.transactionInfo.isCrossChain
            ? this.fromAddress
            : await this.networkWallet.convertAddressForUsage(this.fromAddress, AddressUsage.DISPLAY_TRANSACTIONS),
          show: true
        });
      }

      if (this.targetAddress) {
        // Only show the receiving address for multiable address wallet.
        let elastosMainChainStandardNetworkWallet = this.networkWallet as ElastosMainChainStandardNetworkWallet;
        if (
          this.subWallet.id === StandardCoinName.ELA &&
          !elastosMainChainStandardNetworkWallet.getNetworkOptions().singleAddress
        ) {
          this.txDetails.unshift({
            type: TransactionInfoType.ADDRESS,
            title: 'wallet.tx-info-to',
            value: this.targetAddress,
            show: true
          });
        }
      }
    }

    if (this.transferAmount) {
      this.txDetails.unshift({
        type: TransactionInfoType.AMOUNT,
        title: this.getTransactionTitle(),
        value: this.transferAmount,
        show: true
      });
    }

    if (this.dpos2Votes.length > 0) {
      this.txDetails.unshift({
        type: TransactionInfoType.VOTES,
        title: 'BPoS',
        value: this.dpos2Votes,
        show: false
      });
    }

    if (this.dpos2UpdateVotes.length > 0) {
      this.txDetails.unshift({
        type: TransactionInfoType.VOTES,
        title: 'wallet.coin-op-dpos2-voting-update',
        value: this.dpos2UpdateVotes,
        show: false
      });
    }

    if (this.crProposalVotes.length > 0) {
      this.txDetails.unshift({
        type: TransactionInfoType.VOTES,
        title: 'wallet.coin-op-cr-proposal-against',
        value: this.crProposalVotes,
        show: false
      });
    }

    if (this.crcImpeachmentVotes.length > 0) {
      this.txDetails.unshift({
        type: TransactionInfoType.VOTES,
        title: 'wallet.coin-op-crc-impeachment',
        value: this.crcImpeachmentVotes,
        show: false
      });
    }

    if (this.crCouncilVotes.length > 0) {
      this.txDetails.unshift({
        type: TransactionInfoType.VOTES,
        title: 'wallet.coin-op-crc-vote',
        value: this.crCouncilVotes,
        show: false
      });
    }

    // SYS-006: itemised amount rows. Use the real ticker, not the +/- sign.
    const amountWithSymbol = `${this.displayAmount} ${this.ticker}`;
    if (this.direction === TransactionDirection.RECEIVED) {
      this.txDetails.unshift({
        type: TransactionInfoType.AMOUNT,
        title: 'wallet.tx-info-receive-amount',
        value: amountWithSymbol,
        show: true
      });
    } else {
      // Total deducted only exists when the sent token IS the native token (amount and
      // fee share the unit). Chain semantics differ: the UTXO main chain (ELA) reports
      // the sent amount FEE-INCLUSIVE, so the reported amount is already the total and
      // the value row is amount minus fee; account-model chains (EVM, ...) report the
      // transferred value only, so the total is amount plus fee. Getting this wrong
      // double-counted the fee in the Total row.
      let sentAmount = new BigNumber(String(this.displayAmount).replace(/,/g, ''));
      let valueAmount = sentAmount;
      let totalDeducted: BigNumber = null;
      if (this.payFee !== null && this.ticker === this.mainTokenSymbol) {
        if (this.subWallet.id === StandardCoinName.ELA) {
          totalDeducted = sentAmount;
          valueAmount = sentAmount.minus(new BigNumber(this.payFee));
        } else {
          totalDeducted = sentAmount.plus(new BigNumber(this.payFee));
        }
      }
      if (totalDeducted !== null) {
        this.txDetails.unshift({
          type: TransactionInfoType.AMOUNT,
          title: 'wallet.tx-info-total',
          value: `${WalletUtil.getAmountWithoutScientificNotation(totalDeducted, this.subWallet.tokenDecimals)} ${this.ticker}`,
          show: true
        });
      }
      this.txDetails.unshift({
        type: TransactionInfoType.AMOUNT,
        title: 'wallet.tx-info-amount',
        value: `${WalletUtil.getAmountWithoutScientificNotation(valueAmount, this.subWallet.tokenDecimals)} ${this.ticker}`,
        show: true
      });
    }

    // SYS-006: Address Name (saved contact) with '- -' fallback.
    this.txDetails.unshift({
      type: TransactionInfoType.AMOUNT,
      title: 'wallet.tx-info-address-name',
      value: this.resolveAddressName() || '- -',
      show: true
    });

    // SYS-006: Network row, unshifted last so it renders first (Figma order).
    this.txDetails.unshift({
      type: TransactionInfoType.AMOUNT,
      title: 'wallet.tx-info-network',
      value: WalletNetworkService.instance.activeNetwork.value.getEffectiveName(),
      show: true
    });
  }

  /**
   * Get the real targetAddress by rpc
   */
  async getETHSCTransactionTargetAddres(transaction: EthTransaction) {
    let targetAddress = transaction.to;
    const withdrawContractAddress = (this.subWallet as ElastosEVMSubWallet).getWithdrawContractAddress();
    if (targetAddress && transaction.to.toLowerCase() === withdrawContractAddress.toLowerCase()) {
      targetAddress = await GlobalElastosAPIService.instance.getETHSCWithdrawTargetAddress(
        parseInt(transaction.blockNumber) + 6,
        transaction.hash
      );
      this.crossChainNetworkKey = 'elastos';
    }
    return targetAddress;
  }

  /**
   * Builds the nav-bar title from the transaction direction verb + token ticker,
   * e.g. 'Received ELA'. Falls back to the generic title before data is loaded.
   */
  public getNavTitle(): string {
    if (!this.transactionInfo) {
      return this.translate.instant('wallet.tx-info-title');
    }
    let verb: string;
    switch (this.type) {
      case TransactionType.RECEIVED:
        verb = this.translate.instant('wallet.tx-info-type-received');
        break;
      case TransactionType.SENT:
        verb = this.translate.instant('wallet.tx-info-type-sent');
        break;
      case TransactionType.TRANSFER:
        verb = this.translate.instant('wallet.tx-info-type-transferred');
        break;
      default:
        verb = this.getTransactionTitle();
    }
    return this.ticker ? `${verb} ${this.ticker}` : verb;
  }

  /**
   * Resolves the transaction counterparty address to a saved contact name.
   * Returns null when no contact matches (caller applies the '- -' fallback).
   */
  private resolveAddressName(): string {
    const counterparty = this.direction === TransactionDirection.RECEIVED ? this.fromAddress : this.targetAddress;
    if (!counterparty) {
      return null;
    }
    const target = String(counterparty).toLowerCase();
    const match = this.contactsService.contacts.find(contact =>
      (contact.addresses || []).some(entry => entry.address && entry.address.toLowerCase() === target)
    );
    return match ? match.cryptoname : null;
  }

  public getTransactionTitle(): string {
    let voteName = '';
    let voteTypeCount = 0;

    if (this.dpos2Votes.length > 0) {
      voteTypeCount++;
      voteName = GlobalTranslationService.instance.translateInstant('wallet.coin-op-dpos2-voting');
    }

    if (this.dpos2UpdateVotes.length > 0) {
      voteTypeCount++;
      voteName = GlobalTranslationService.instance.translateInstant('wallet.coin-op-dpos2-voting-update');
    }

    if (this.crProposalVotes.length > 0) {
      if (voteTypeCount) voteName += ' + ';
      voteName += GlobalTranslationService.instance.translateInstant('wallet.coin-op-cr-proposal-against');
      voteTypeCount++;
    }

    if (this.crcImpeachmentVotes.length > 0) {
      if (voteTypeCount) voteName += ' + ';
      voteName += GlobalTranslationService.instance.translateInstant('wallet.coin-op-crc-impeachment');
      voteTypeCount++;
    }

    if (this.crCouncilVotes.length > 0) {
      if (voteTypeCount) voteName += ' + ';
      voteName += GlobalTranslationService.instance.translateInstant('wallet.coin-op-crc-vote');
      voteTypeCount++;
    }

    if (voteTypeCount > 2) {
      voteName = 'wallet.coin-op-vote';
    } else if (voteTypeCount == 0) {
      if (this.isUnvoteTx) {
        voteName = GlobalTranslationService.instance.translateInstant('wallet.coin-op-voting-cancel');
      } else {
        voteName = GlobalTranslationService.instance.translateInstant(this.transactionInfo.name);
      }
    }

    return voteName;
  }

  getTransferClass() {
    switch (this.type) {
      case 1:
        return 'received';
      case 2:
        return 'sent';
      case 3:
        return 'transferred';
    }
  }

  worthCopying(item: TransactionDetail) {
    switch (item.type) {
      case TransactionInfoType.BLOCKID:
      case TransactionInfoType.TXID:
      case TransactionInfoType.ADDRESS:
      case TransactionInfoType.CONTRACTADDRESS:
      case TransactionInfoType.MEMO:
        return true;
      default:
        return false;
    }
  }

  worthOpenForBrowser(item: TransactionDetail) {
    switch (item.type) {
      case TransactionInfoType.BLOCKID:
      case TransactionInfoType.TXID:
      case TransactionInfoType.ADDRESS:
        return true;
      default:
        return false;
    }
  }

  async openForBrowseMode(item: TransactionDetail) {
    let value = item.value;
    let network = WalletNetworkService.instance.activeNetwork.value;
    switch (item.type) {
      case 'blockId':
        if (this.subWallet.id === StandardCoinName.ELA) {
          value = await GlobalElastosAPIService.instance.getELABlockHash(item.value);
        }
        break;
      case 'address':
        if (this.transactionInfo.isCrossChain && this.crossChainNetworkKey) {
          network = WalletNetworkService.instance.getNetworkByKey(this.crossChainNetworkKey);
        }
        break;
      default:
        break;
    }

    let browserUrl = network.getBrowserUrlByType(item.type, value);
    if (browserUrl) {
      void this.dappbrowserService.openForBrowseMode(browserUrl, '');
    }
  }

  copy(value) {
    void this.native.copyClipboard(value);
    void this.native.toast_trans('wallet.copied');
  }

  /**
   * Deletes this temporary offlien transction and exits the screen.
   */
  private async deleteOfflineTransaction() {
    await this.offlineTransactionsService.removeTransaction(this.subWallet, this.offlineTransaction);
    void this.nav.navigateBack();
  }

  public getValueType(item: TransactionDetail) {
    if (item.value instanceof Array) {
      if (item.type === 'votes') {
        return ValueType.Votes;
      }
      return ValueType.StringArray;
    }
    return ValueType.Normal;
  }

  // Readability split: the rows that answer "what happened" render in a primary card,
  // in a fixed human order; everything else (txid, token internals, vote arrays, memo)
  // collapses behind a Technical details toggle. Purely presentational - every row the
  // per-chain builders produce is still shown, nothing is dropped.
  private static readonly ESSENTIAL_ROW_ORDER = [
    'wallet.tx-info-amount',
    'wallet.tx-info-erc20-amount',
    'wallet.tx-info-receive-amount',
    'wallet.tx-info-from',
    'wallet.tx-info-to',
    'wallet.tx-info-address',
    'wallet.tx-info-address-name',
    'wallet.tx-info-network',
    'wallet.tx-info-network-fee',
    'wallet.tx-info-total',
    'wallet.tx-info-time',
    'wallet.tx-info-confirmations'
  ];

  public showTechnical = false;

  public get essentialDetails(): TransactionDetail[] {
    return this.txDetails
      .filter(item => CoinTxInfoPage.ESSENTIAL_ROW_ORDER.includes(item.title))
      .sort(
        (a, b) =>
          CoinTxInfoPage.ESSENTIAL_ROW_ORDER.indexOf(a.title) - CoinTxInfoPage.ESSENTIAL_ROW_ORDER.indexOf(b.title)
      );
  }

  public get technicalDetails(): TransactionDetail[] {
    return this.txDetails.filter(item => !CoinTxInfoPage.ESSENTIAL_ROW_ORDER.includes(item.title));
  }

  private async getVoteInfo(voteContents: VotesContentInfo[]) {
    let votes = null;
    for (let i = 0; i < voteContents.length; i++) {
      switch (voteContents[i].VoteType) {
        case VoteType.DPoSV2:
          votes = await this.getDPoS2VoteInfo(voteContents[i]);
          this.dpos2Votes = [...this.dpos2Votes, ...votes];
          break;
        case VoteType.CRImpeachment:
          votes = await this.getCRImpeachmentVoteInfo(voteContents[i]);
          this.crcImpeachmentVotes = [...this.crcImpeachmentVotes, ...votes];
          break;
        case VoteType.CRProposal:
          votes = await this.getCRProposalVoteInfo(voteContents[i]);
          this.crProposalVotes = [...this.crProposalVotes, ...votes];
          break;
        case VoteType.CRCouncil:
          votes = await this.getCRCouncilVoteInfo(voteContents[i]);
          this.crCouncilVotes = [...this.crCouncilVotes, ...votes];
          break;
        default:
          Logger.warn('wallet', 'getVoteInfo: not support', voteContents);
          break;
      }
    }
  }

  private async getRenewalVotesContentInfo(voteContents: RenewalVotesContentInfo[]) {
    let votes = null;
    for (let i = 0; i < voteContents.length; i++) {
      votes = await this.getDPoS2UpdateVoteInfo(voteContents[i]);
      this.dpos2UpdateVotes = [...this.dpos2UpdateVotes, ...votes];
    }
  }

  // Multi-signature wallet owners need to know these voting information before signing.
  private async getDPoS2VoteInfo(voteContentInfo: VotesContentInfo) {
    if (voteContentInfo.VoteType !== VoteType.DPoSV2) return [];
    let voteList = [];

    let currentHeight = await GlobalElastosAPIService.instance.getCurrentHeight();
    let currentBlock = await GlobalElastosAPIService.instance.getBlockByHeight(currentHeight);

    const result = await GlobalElastosAPIService.instance.fetchDposNodes('all', NodeType.BPoS);
    if (result) {
      let dpos2Nodes = result.producers.filter(node => node.identity && node.identity !== 'DPoSV1');
      for (let i = 0; i < voteContentInfo.VotesInfo.length; i++) {
        let dpos2Node = dpos2Nodes.find(node => node.ownerpublickey === voteContentInfo.VotesInfo[i].Candidate);
        let lockDate = this.getStakeDate(voteContentInfo.VotesInfo[i].Locktime, currentHeight, currentBlock.time);
        let votes = WalletUtil.getFriendlyBalance(
          new BigNumber(voteContentInfo.VotesInfo[i].Votes).dividedBy(Config.SELA)
        );
        voteList.push({
          Candidate: voteContentInfo.VotesInfo[i].Candidate,
          LockDate: lockDate,
          Votes: votes,
          Title: dpos2Node?.nickname
        });
      }
    }
    Logger.log('wallet', 'getDPoS2VoteInfo ', voteList);
    return voteList;
  }

  // Multi-signature wallet owners need to know these voting information before signing.
  private async getDPoS2UpdateVoteInfo(voteContentInfo: RenewalVotesContentInfo) {
    let voteList = [];

    let currentHeight = await GlobalElastosAPIService.instance.getCurrentHeight();
    let currentBlock = await GlobalElastosAPIService.instance.getBlockByHeight(currentHeight);

    const result = await GlobalElastosAPIService.instance.fetchDposNodes('all', NodeType.BPoS);
    if (result) {
      let dpos2Nodes = result.producers.filter(node => node.identity && node.identity !== 'DPoSV1');
      let dpos2Node = dpos2Nodes.find(node => node.ownerpublickey === voteContentInfo.VoteInfo.Candidate);
      let lockDate = this.getStakeDate(voteContentInfo.VoteInfo.Locktime, currentHeight, currentBlock.time);
      let votes = WalletUtil.getFriendlyBalance(new BigNumber(voteContentInfo.VoteInfo.Votes).dividedBy(Config.SELA));
      voteList.push({
        Candidate: voteContentInfo.VoteInfo.Candidate,
        LockDate: lockDate,
        Votes: votes,
        Title: dpos2Node?.nickname
      });
    }
    Logger.log('wallet', 'getDPoS2UpdateVoteInfo ', voteList);
    return voteList;
  }

  // Convert block to date
  private getStakeDate(locktime: number, currentHeight: number, currentBlockTimestamp: number) {
    var until = locktime - currentHeight;
    var stakeTimestamp = until * 120 + currentBlockTimestamp;
    return moment(stakeTimestamp * 1000).format('MMMM Do YYYY');
  }

  // Multi-signature wallet owners need to know these voting information before signing.
  private async getCRProposalVoteInfo(voteContentInfo: VotesContentInfo) {
    if (voteContentInfo.VoteType !== VoteType.CRProposal) return [];
    let voteList = [];

    for (let i = 0; i < voteContentInfo.VotesInfo.length; i++) {
      const proposalDetail = await GlobalElastosAPIService.instance.fetchProposalDetails(
        voteContentInfo.VotesInfo[i].Candidate
      );
      if (proposalDetail) {
        let votes = WalletUtil.getFriendlyBalance(
          new BigNumber(voteContentInfo.VotesInfo[i].Votes).dividedBy(Config.SELA)
        );
        let title = '#' + proposalDetail.id + ' ' + proposalDetail.title;
        voteList.push({
          Candidate: voteContentInfo.VotesInfo[i].Candidate,
          LockDate: null,
          Votes: votes,
          Title: title
        });
      }
    }

    Logger.log('wallet', 'getCRProposalVoteInfo ', voteList);
    return voteList;
  }

  // Multi-signature wallet owners need to know these voting information before signing.
  private async getCRImpeachmentVoteInfo(voteContentInfo: VotesContentInfo) {
    if (voteContentInfo.VoteType !== VoteType.CRImpeachment) return [];
    let voteList = [];

    for (let i = 0; i < voteContentInfo.VotesInfo.length; i++) {
      let crcouncil = await GlobalElastosAPIService.instance.getCRMember(voteContentInfo.VotesInfo[i].Candidate);
      if (crcouncil) {
        let votes = WalletUtil.getFriendlyBalance(
          new BigNumber(voteContentInfo.VotesInfo[i].Votes).dividedBy(Config.SELA)
        );
        voteList.push({
          Candidate: voteContentInfo.VotesInfo[i].Candidate,
          LockDate: null,
          Votes: votes,
          Title: crcouncil.nickname
        });
      }
    }

    Logger.log('wallet', 'getCRImpeachmentVoteInfo ', voteList);
    return voteList;
  }

  // Multi-signature wallet owners need to know these voting information before signing.
  private async getCRCouncilVoteInfo(voteContentInfo: VotesContentInfo) {
    if (voteContentInfo.VoteType !== VoteType.CRCouncil) return [];
    let voteList = [];

    const result = await GlobalElastosAPIService.instance.getCRCandidates();
    if (result && result.crcandidatesinfo) {
      let candidateList = result.crcandidatesinfo;
      for (let i = 0; i < voteContentInfo.VotesInfo.length; i++) {
        let candidate = candidateList.find(c => c.cid == voteContentInfo.VotesInfo[i].Candidate);
        if (candidate) {
          let votes = WalletUtil.getFriendlyBalance(
            new BigNumber(voteContentInfo.VotesInfo[i].Votes).dividedBy(Config.SELA)
          );
          voteList.push({
            Candidate: voteContentInfo.VotesInfo[i].Candidate,
            LockDate: null,
            Votes: votes,
            Title: candidate.nickname
          });
        }
      }
    }

    Logger.log('wallet', 'getCRCouncilVoteInfo ', voteList);
    return voteList;
  }

  private async getInscriptionInfo(txid: string) {
    try {
      // TODO: Avoid repeated calls getTransactionDetails
      const transaction = await (this.subWallet as ElastosEVMSubWallet).getTransactionDetails(txid);
      let info = await InscriptionUtil.getInscriptionData(transaction.input);

      this.zone.run(() => {
        this.txDetails.unshift({
          type: TransactionInfoType.INSCRIPTION,
          title: 'wallet.ext-tx-info-type-inscription',
          value: info,
          show: true
        });
      });
    } catch (e) {
      // Silent catch
    }
  }
}
