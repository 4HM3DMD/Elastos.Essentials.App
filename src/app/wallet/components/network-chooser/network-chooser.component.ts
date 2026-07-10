import { Component, OnDestroy, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { Logger } from 'src/app/logger';
import { GlobalPreferencesService } from 'src/app/services/global.preferences.service';
import { DIDSessionsStore } from 'src/app/services/stores/didsessions.store';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { ALL_CHAINS_GLYPH_LOGOS } from '../../model/aggregated-token';
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
  /**
   * SCR-087: when the chooser is opened to pick a network for a specific token, set this to true so
   * known chains render their token standard suffix (e.g. "Ethereum (ERC20)"). Defaults to false for
   * generic active-network switching, where the bare network name is shown.
   */
  showTokenStandard?: boolean;
  /**
   * Shows the pinned "All Chains" aggregate entry at the top of the list. Only meaningful when
   * choosing the ACTIVE network (not when picking a network for a token or a receive address).
   */
  showAllChains?: boolean;
}

/** SCR-087: token standard label appended to the network name on known chains when picking for a token. */
const TOKEN_STANDARD_BY_NETWORK_KEY: { [networkKey: string]: string } = {
  ethereum: 'ERC20',
  bsc: 'BEP20',
  tron: 'TRC20'
};

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
  public displayedNetworks: AnyNetwork[] = [];
  public elastosNetworks: AnyNetwork[] = [];
  public otherNetworks: AnyNetwork[] = [];
  public searchInput = '';
  public allChainsOn = false;
  public readonly allChainsGlyphLogos = ALL_CHAINS_GLYPH_LOGOS;

  private netListSubscription: Subscription = null;

  constructor(
    private navParams: NavParams,
    private networkService: WalletNetworkService,
    public uiService: UiService,
    public translate: TranslateService,
    public theme: GlobalThemeService,
    public currencyService: CurrencyService,
    private modalCtrl: ModalController,
    private native: Native,
    private prefs: GlobalPreferencesService
  ) {
  }

  ngOnInit() {
    this.options = this.navParams.data as NetworkChooserComponentOptions;

    if (this.options.showActiveNetwork)
      this.currentNetwork = this.options.currentNetwork;
    else
      this.currentNetwork = null;

    if (this.options.showAllChains) {
      void this.prefs.getAllChainsMode(DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate)
        .then(on => { this.allChainsOn = on; });
    }

    this.netListSubscription = this.networkService.networksList.subscribe(_ => {
      let networks = this.networkService.getDisplayableNetworks();
      this.networksToShowInList = networks.filter(n => {
        return (!this.options.filter || this.options.filter(n));
      });
      this.applyNetworkFilter();
    });
  }

  ngOnDestroy() {
    if (this.netListSubscription) {
      this.netListSubscription.unsubscribe();
      this.netListSubscription = null;
    }
  }

  /** Recomputes the rendered list from the search box; called on list load and on each keystroke. */
  public applyNetworkFilter() {
    let query = this.searchInput.trim().toLowerCase();
    this.displayedNetworks = query
      ? this.networksToShowInList.filter(n => n.getEffectiveName().toLowerCase().includes(query))
      : this.networksToShowInList;

    // Grouped sections (Elastos ecosystem first) shown when not searching; a search
    // renders the flat filtered list instead.
    this.elastosNetworks = this.displayedNetworks.filter(n => this.isElastosFamily(n));
    this.otherNetworks = this.displayedNetworks.filter(n => !this.isElastosFamily(n));
  }

  public get searching(): boolean {
    return this.searchInput.trim().length > 0;
  }

  /** All Elastos ecosystem network keys share the 'elastos' prefix (elastos, elastossmartchain, elastosidchain, elastosecopgp...). */
  private isElastosFamily(network: AnyNetwork): boolean {
    return network.key.startsWith('elastos');
  }

  public trackByKey(_index: number, network: AnyNetwork): string {
    return network.key;
  }

  /** The Elastos main chain hosts governance and staking tools; its row carries a tools tag. */
  public isMainChain(network: AnyNetwork): boolean {
    return network.key === 'elastos';
  }

  /**
   * SCR-087: display name for a network row. When choosing a network for a specific token
   * (showTokenStandard), known chains gain their token standard suffix, e.g. "Ethereum (ERC20)".
   * For generic network switching the bare effective name is returned unchanged.
   */
  public getNetworkDisplayName(network: AnyNetwork): string {
    const baseName = network.getEffectiveName();
    if (!this.options || !this.options.showTokenStandard) {
      return baseName;
    }
    const standard = TOKEN_STANDARD_BY_NETWORK_KEY[network.key];
    return standard ? `${baseName} (${standard})` : baseName;
  }

  selectNetwork(network: AnyNetwork) {
    Logger.log("wallet", "Network selected", network);

    void this.modalCtrl.dismiss({
      selectedNetworkKey: network.key
    });
  }

  /** The single active network row is checked only while the aggregate view is off. */
  public isNetworkChecked(network: AnyNetwork): boolean {
    if (this.options.showAllChains && this.allChainsOn) return false;
    return this.currentNetwork && network.key === this.currentNetwork.key;
  }

  selectAllChains() {
    Logger.log("wallet", "All chains aggregate view selected");

    void this.modalCtrl.dismiss({
      selectedAllChains: true
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
