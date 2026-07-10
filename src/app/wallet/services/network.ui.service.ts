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

import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { GlobalPreferencesService } from 'src/app/services/global.preferences.service';
import { DIDSessionsStore } from 'src/app/services/stores/didsessions.store';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import {
  NetworkChooserComponent,
  NetworkChooserComponentOptions,
  NetworkChooserFilter
} from '../components/network-chooser/network-chooser.component';
import { AnyNetwork } from '../model/networks/network';
import { WalletNetworkService } from './network.service';

export type PriorityNetworkChangeCallback = (newNetwork) => Promise<void>;

/** Ionic sheet presentation shared by the chooser entry points (SCR-005 sheet pattern). */
const CHOOSER_SHEET_PRESENTATION = {
  breakpoints: [0, 0.72, 0.95],
  initialBreakpoint: 0.72,
  // The shared ui-sheet-header renders the grabber; Ionic's own handle would double it.
  handle: false,
  cssClass: 'network-chooser-sheet'
};

@Injectable({
  providedIn: 'root'
})
export class WalletNetworkUIService {
  public static instance: WalletNetworkUIService = null;

  constructor(
    private modalCtrl: ModalController,
    private networkService: WalletNetworkService,
    private theme: GlobalThemeService,
    private prefs: GlobalPreferencesService
  ) {
    WalletNetworkUIService.instance = this;
  }

  /**
   * Lets user pick a network in the list of all available networks, or the
   * "All Chains" aggregate view. Picking a specific network switches to it and
   * leaves the aggregate view; picking All Chains enables the aggregate view
   * without touching the underlying active network.
   * Promise resolves when a choice is made or when cancelled.
   *
   * @param filter Optional filter to show only specific networks
   * @dependson NetworkChooserComponentModule
   */
  async chooseActiveNetwork(filter?: NetworkChooserFilter, showAllChains = false): Promise<boolean> {
    let options: NetworkChooserComponentOptions = {
      currentNetwork: this.networkService.activeNetwork.value,
      filter,
      showActiveNetwork: true,
      // Only the wallet surfaces that render the aggregate view opt in; other
      // callers (dApp browser, widgets, red packets) need a concrete network.
      showAllChains
    };

    let modal = await this.modalCtrl.create({
      component: NetworkChooserComponent,
      componentProps: options,
      ...CHOOSER_SHEET_PRESENTATION
    });

    return new Promise(resolve => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, require-await
      modal.onWillDismiss().then(async params => {
        // The preference writes are awaited so callers can re-read the mode
        // right after this promise resolves (no stale-read race).
        if (params.data && params.data.selectedAllChains) {
          await this.prefs.setAllChainsMode(
            DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, true
          );
          resolve(true);
        } else if (params.data && params.data.selectedNetworkKey) {
          await this.prefs.setAllChainsMode(
            DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, false
          );
          // Await the switch so callers re-render against the NEW network's wallets.
          await this.networkService.setActiveNetwork(
            this.networkService.getNetworkByKey(params.data.selectedNetworkKey)
          );
          resolve(true);
        } else resolve(false);
      });
      void modal.present();
    });
  }

  /**
   * Lets the user choose a network from the list but without further action.
   * The selected network does not become the active network.
   */
  async pickNetwork(filter?: NetworkChooserFilter): Promise<AnyNetwork> {
    let options: NetworkChooserComponentOptions = {
      currentNetwork: this.networkService.activeNetwork.value,
      filter,
      showActiveNetwork: false
    };

    let modal = await this.modalCtrl.create({
      component: NetworkChooserComponent,
      componentProps: options,
      ...CHOOSER_SHEET_PRESENTATION
    });

    return new Promise(resolve => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, require-await
      modal.onWillDismiss().then(async params => {
        if (params.data && params.data.selectedNetworkKey) {
          let network = this.networkService.getNetworkByKey(params.data.selectedNetworkKey);
          resolve(network);
        } else resolve(null);
      });
      void modal.present();
    });
  }
}
