import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Logger } from 'src/app/logger';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { ReceiveTarget } from 'src/app/wallet/model/aggregated-token';
import { AggregatedTokensService } from 'src/app/wallet/services/aggregated-tokens.service';
import { CoinTransferService } from '../../../../services/cointransfer.service';
import { Native } from '../../../../services/native.service';

/** Elastos ecosystem chains share this key prefix; everything else is an "other" network. */
const ELASTOS_KEY_PREFIX = 'elastos';

/** Middle-ellipsis form of an address for a compact list row (full value stays for the QR screen). */
function shortenAddress(address: string): string {
  if (!address || address.length <= 16) {
    return address || '';
  }
  return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
}

/**
 * Multi-chain Receive: a full page listing every chain the active wallet can receive
 * on. A chain address receives every token on that chain, so the choice is a chain,
 * not a token. Addresses come from the all-chains side-instances, so opening this page
 * and picking a chain never switches the app's active network (the aggregate view is
 * preserved). Picking a chain opens the standard Receive screen for that chain.
 */
@Component({
  selector: 'app-coin-receive-select',
  templateUrl: './coin-receive-select.page.html',
  styleUrls: ['./coin-receive-select.page.scss']
})
export class CoinReceiveSelectPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  public loading = true;
  public elastosTargets: ReceiveTarget[] = [];
  public otherTargets: ReceiveTarget[] = [];
  // Fixed-length placeholder list for the loading state (lifted so render never re-allocates).
  public readonly skeletonRows = [0, 1, 2, 3];

  constructor(
    public theme: GlobalThemeService,
    private translate: TranslateService,
    private aggService: AggregatedTokensService,
    private coinTransferService: CoinTransferService,
    private native: Native
  ) {}

  ngOnInit() {
    void this.load();
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('wallet.coin-receive-select-title'));
  }

  private async load() {
    // The side-instances are already built while in aggregate mode; awaiting ensureBuilt
    // guarantees the addresses are ready (and builds them if the page is reached early).
    try {
      await this.aggService.ensureBuilt();
      const targets = this.aggService.getReceiveTargets();
      this.elastosTargets = targets.filter(t => t.network.key.startsWith(ELASTOS_KEY_PREFIX));
      this.otherTargets = targets.filter(t => !t.network.key.startsWith(ELASTOS_KEY_PREFIX));
    } catch (e) {
      // Never leave the page stuck on the loading skeleton; fall through to the empty state.
      Logger.warn('wallet', 'coin-receive-select: failed to load receive targets', e);
    } finally {
      this.loading = false;
    }
  }

  public get hasTargets(): boolean {
    return this.elastosTargets.length > 0 || this.otherTargets.length > 0;
  }

  public shortAddress(address: string): string {
    return shortenAddress(address);
  }

  public trackByKey(_index: number, target: ReceiveTarget): string {
    return target.network.key;
  }

  /**
   * Show the chosen chain's address on the standard Receive screen. receiveNetworkKey
   * makes coin-receive resolve the chain from the side-instance, so the app's active
   * network is never switched.
   */
  public onPick(target: ReceiveTarget) {
    this.coinTransferService.masterWalletId = target.networkWallet.id;
    this.coinTransferService.subWalletId = target.mainSubWallet.id;
    this.coinTransferService.receiveNetworkKey = target.network.key;
    this.native.go('/wallet/coin-receive');
  }
}
