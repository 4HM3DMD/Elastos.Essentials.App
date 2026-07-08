import { Component, Input, NgZone, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { Native } from '../../services/native.service';
import { OutgoingTransactionState, TransactionService } from '../../services/transaction.service';
import { WalletService } from '../../services/wallet.service';

/**
 * Generic transaction publication component.
 * Doesn't wait for confirmation.
 */
@Component({
  selector: 'app-std-transaction',
  templateUrl: './std-transaction.component.html',
  styleUrls: ['./std-transaction.component.scss'],
})
export class StdTransactionComponent implements OnInit {
  // SCR-011 / SCR-034: amount hero + interpolated title context, fed via componentProps.
  @Input() public symbol = '';
  @Input() public amount: string = null;
  @Input() public fiat: string = null;
  @Input() public icon: string = null;

  // SCR-012: send-context summary rows, fed via componentProps.
  @Input() public networkName: string = null;
  @Input() public address: string = null;
  @Input() public addressName: string = null;
  @Input() public receiveAmount: string = null;
  @Input() public fee: string = null;
  @Input() public totalDeducted: string = null;

  // SCR-013: published transaction hash, surfaced as a copyable row once available.
  @Input() public txId: string = null;

  public publishing = false;
  public publicationSuccessful = false;
  public publicationFailed = false;
  public errorMessage = '';

  private outgoingTxStateSub: Subscription = null;

  constructor(
    public theme: GlobalThemeService,
    private zone: NgZone,
    private modalCtrl: ModalController,
    private native: Native,
    private transactionService: TransactionService
  ) { }

  ngOnInit(): void {
  }

  ionViewWillEnter() {
    this.publishing = true;
    this.publicationSuccessful = false;
    this.publicationFailed = false;
    this.outgoingTxStateSub = this.transactionService.onGoingPublicationState.subscribe(txState => {
      if (txState.state === OutgoingTransactionState.ERRORED) {
        this.zone.run(() => {
          this.publicationFailed = true;
          this.publishing = false;
          this.errorMessage = txState.message;
        });
      }
      else if (txState.state === OutgoingTransactionState.PUBLISHED) {
        // SCR-033: settle into a completed state on the same progress screen (no auto-dismiss).
        // Notify the wallet so its lists refresh; the sheet stays open until the user closes it.
        this.zone.run(() => {
          this.publishing = false;
          this.publicationSuccessful = true;
        });
        WalletService.instance.events.publish('wallet:transactionpublished');
      }
    });
  }

  ionViewWillLeave() {
    if (this.outgoingTxStateSub) {
      this.outgoingTxStateSub.unsubscribe();
      this.outgoingTxStateSub = null;
    }
  }

  // SCR-013: copy the published transaction hash.
  public copyTxId() {
    if (!this.txId) return;
    void this.native.copyClipboard(this.txId);
    this.native.toast_trans('wallet.copied', 2000);
  }

  exitComponent() {
    void this.modalCtrl.dismiss();
  }

  cancel() {
    this.exitComponent();
  }
}
