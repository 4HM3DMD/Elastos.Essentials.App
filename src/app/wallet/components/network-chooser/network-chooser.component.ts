import { Component, OnDestroy, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { Logger } from 'src/app/logger';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { CoinType } from '../../model/coin';
import { AnyNetwork } from '../../model/networks/network';
import { CurrencyService } from '../../services/currency.service';
import { Native } from '../../services/native.service';
import { WalletNetworkService } from '../../services/network.service';
import { UiService } from '../../services/ui.service';

/**
 * Filter method to return only some networks to show in the chooser.
 */
export type NetworkChooserFilter = (networks: AnyNetwork) => boolean;

export type NetworkChooserComponentOptions = {
  currentNetwork: AnyNetwork;
  //masterWallet: MasterWallet;
  /**
   * Optional filter. Only returned networks will show in the list.
   * Return true to keep the network in the list, false to hide it.
   */
  filter?: NetworkChooserFilter;
  /**
   * If true, the active network is pre-selected in the list. Otherwise, all networks are displayed
   * in the same way.
   */
  showActiveNetwork?: boolean;
}

@Component({
  selector: 'app-network-chooser',
  templateUrl: './network-chooser.component.html',
  styleUrls: ['./network-chooser.component.scss'],
})
export class NetworkChooserComponent implements OnInit, OnDestroy {
  public CoinType = CoinType;
  public options: NetworkChooserComponentOptions = null;
  public currentNetwork: AnyNetwork;
  public networksToShowInList: AnyNetwork[] = [];
  public searchInput = '';

  private netListSubscription: Subscription = null;

  constructor(
    private navParams: NavParams,
    private networkService: WalletNetworkService,
    public uiService: UiService,
    public translate: TranslateService,
    public theme: GlobalThemeService,
    public currencyService: CurrencyService,
    private modalCtrl: ModalController,
    private native: Native
  ) {
  }

  ngOnInit() {
    this.options = this.navParams.data as NetworkChooserComponentOptions;

    if (this.options.showActiveNetwork)
      this.currentNetwork = this.options.currentNetwork;
    else
      this.currentNetwork = null;

    this.netListSubscription = this.networkService.networksList.subscribe(_ => {
      let networks = this.networkService.getDisplayableNetworks();
      this.networksToShowInList = networks.filter(n => {
        return (!this.options.filter || this.options.filter(n));
      });
    });
  }

  ngOnDestroy() {
    if (this.netListSubscription) {
      this.netListSubscription.unsubscribe();
      this.netListSubscription = null;
    }
  }

  /** The networks to render, narrowed by the search box (case-insensitive name match). */
  public get displayedNetworks(): AnyNetwork[] {
    let query = this.searchInput.trim().toLowerCase();
    if (!query) return this.networksToShowInList;
    return this.networksToShowInList.filter(n => n.getEffectiveName().toLowerCase().includes(query));
  }

  /** The Elastos main chain hosts governance and staking tools; its row carries a tools tag. */
  public isMainChain(network: AnyNetwork): boolean {
    return network.key === 'elastos';
  }

  selectNetwork(network: AnyNetwork) {
    Logger.log("wallet", "Network selected", network);

    void this.modalCtrl.dismiss({
      selectedNetworkKey: network.key
    });
  }

  cancelOperation() {
    Logger.log("wallet", "Network selection cancelled");
    void this.modalCtrl.dismiss();
  }

  public manageNetworks() {
    this.cancelOperation(); // Can't open networks management over the network chooser modal, so we just close it.
    this.native.go('/wallet/settings/manage-networks');
  }
}
