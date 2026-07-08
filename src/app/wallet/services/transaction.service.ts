import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { Logger } from 'src/app/logger';

export enum OutgoingTransactionState {
  IDLE,
  PUBLISHING,
  PUBLISHED,
  ERRORED
}

export type OutgoingTransactionStatus = {
  state: OutgoingTransactionState;
  message?: string;
  // SCR-013: published transaction hash, surfaced once the state becomes PUBLISHED so the
  // generic publication sheet can render a copyable TXID row.
  txId?: string;
}

const idleStatus = (): OutgoingTransactionStatus => {
  return {
    state: OutgoingTransactionState.IDLE
  };
}

/**
 * Follow up of all wallet outgoing transactions, for now mostly to update the UI.
 * Each service that initiates wawllet tx publications is responsible for updating
 * transactions status.
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  public static instance: TransactionService = null;

  public onGoingPublicationState = new BehaviorSubject<OutgoingTransactionStatus>(idleStatus());

  constructor(
    private modalCtrl: ModalController,
    public translate: TranslateService,
  ) {
    TransactionService.instance = this;
  }

  public resetTransactionPublicationStatus() {
    this.onGoingPublicationState.next(idleStatus());
  }

  /**
   * Shows a standard bottom sheet loader that waits with a spinner until it gets manually
   * closed by this service.
   *
   * This is used to let users wait while publishing transactions.
   *
   * Implementations of publishTransaction() in subwallets decide if they want to use this
   * generic implementation or if they want to use their own sheet, like EVM wallets.
   *
   * SCR-011/012/034: the send-context (amount/symbol/icon/fiat/networkName/address/...) built by
   * the subwallet caller is threaded through as componentProps so the redesigned sheet can render
   * its amount hero, interpolated title and summary rows.
   */
  public async displayGenericPublicationLoader(componentProps: Record<string, any> = {}) {
    const modal = await this.modalCtrl.create({
      // eslint-disable-next-line import/no-cycle
      component: (await import('../components/std-transaction/std-transaction.component')).StdTransactionComponent,
      componentProps,
      // Not backdrop-dismissible: dismissing mid-publish let a later transaction's sheet
      // read THIS one's PUBLISHED state/txId from the shared subject (false success, wrong
      // hash) and hid ERRORED states. The in-sheet Close pill (SCR-014) is the explicit dismiss.
      backdropDismiss: false,
      cssClass: "wallet-component-base"
    });

    void modal.onDidDismiss().then((params) => {
      //
    });

    void modal.present();
  }

  public setOnGoingPublishedTransactionState(state: OutgoingTransactionState, message: string = null, txId: string = null) {
    Logger.log("wallet", "New outgoing transaction state:", state);
    this.onGoingPublicationState.next({
      state: state,
      message: message,
      txId: txId
    });
  }
}
