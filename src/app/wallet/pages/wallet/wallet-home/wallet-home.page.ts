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

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import BigNumber from 'bignumber.js';
import { Subscription } from 'rxjs';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { BuiltInIcon, TitleBarIcon, TitleBarIconSlot, TitleBarMenuItem } from 'src/app/components/titlebar/titlebar.types';
import { reducedWalletAddress } from 'src/app/helpers/wallet.helper';
import { WalletAddressChooserComponent } from 'src/app/launcher/components/wallet-address-chooser/wallet-address-chooser.component';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalFirebaseService } from 'src/app/services/global.firebase.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalStartupService } from 'src/app/services/global.startup.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { CoinType } from 'src/app/wallet/model/coin';
import { LedgerMasterWallet } from 'src/app/wallet/model/masterwallets/ledger.masterwallet';
import { WalletType } from 'src/app/wallet/model/masterwallets/wallet.types';
import { AnyNetworkWallet, WalletAddressInfo } from 'src/app/wallet/model/networks/base/networkwallets/networkwallet';
import { MainChainSubWallet } from 'src/app/wallet/model/networks/elastos/mainchain/subwallets/mainchain.subwallet';
import { NFT } from 'src/app/wallet/model/networks/evms/nfts/nft';
import { AnyNetwork } from 'src/app/wallet/model/networks/network';
import { TronSubWallet } from 'src/app/wallet/model/networks/tron/subwallets/tron.subwallet';
import { WalletUtil } from 'src/app/wallet/model/wallet.util';
import { WalletSortType } from 'src/app/wallet/model/walletaccount';
import { DefiService, StakingData } from 'src/app/wallet/services/evm/defi.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { WalletNetworkUIService } from 'src/app/wallet/services/network.ui.service';
import { WalletUIService } from 'src/app/wallet/services/wallet.ui.service';
import { Config } from '../../../config/Config';
import { MasterWallet } from '../../../model/masterwallets/masterwallet';
import { MainCoinSubWallet } from '../../../model/networks/base/subwallets/maincoin.subwallet';
import { AnySubWallet } from '../../../model/networks/base/subwallets/subwallet';
import { CurrencyService } from '../../../services/currency.service';
import { PriceHistoryService } from '../../../services/pricehistory.service';
import { Native } from '../../../services/native.service';
import { LocalStorage } from '../../../services/storage.service';
import { UiService } from '../../../services/ui.service';
import { WalletService } from '../../../services/wallet.service';
import { WalletEditionService } from '../../../services/walletedition.service';
import { LedgerConnectType } from '../ledger/ledger-connect/ledger-connect.page';
import { Logger } from 'src/app/logger';
import { GlobalPreferencesService } from 'src/app/services/global.preferences.service';
import { DIDSessionsStore } from 'src/app/services/stores/didsessions.store';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import { SubValueTone } from 'src/app/components/ui/ui-token-row/ui-token-row.component';
import { formatFiatAmount } from 'src/app/helpers/currency-format';
import { UiChip } from 'src/app/components/ui/ui-chip-row/ui-chip-row.component';

/** Precomputed presentation model for one token row (keeps getters out of the template). */
interface TokenRowViewModel {
    icon: string;
    badge: string;
    title: string;
    native: string; // left subtitle: the holding, e.g. "1.5 ELA"
    fiat: string; // right primary: fiat value, glyph-prefixed
    changeSubValue: string | null; // local 24h %change label, null until enough history
    tone: SubValueTone; // tone for the %change line
    subWallet: AnySubWallet;
}

/** Precomputed presentation model for one collectible (NFT) row. */
interface NftRowViewModel {
    icon: string;
    badge: string;
    title: string;
    sub: string;
    count: string;
    nft: NFT;
}

/** Precomputed presentation model for one staked-asset (DeFi) row. */
interface StakingRowViewModel {
    icon: string;
    title: string;
    fiat: string;
    data: StakingData;
}

/** Precomputed presentation model for the total-balance display. */
interface BalanceViewModel {
    primary: string;
    unit: string;
    secondary: string;
    pnl: { text: string; tone: 'up' | 'down' } | null; // local 24h portfolio PnL, null until enough history
}

@Component({
    selector: 'app-wallet-home',
    templateUrl: './wallet-home.page.html',
    styleUrls: ['./wallet-home.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletHomePage implements OnInit, OnDestroy {
    @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

    public masterWallet: MasterWallet = null;
    public networkWallet: AnyNetworkWallet = null;
    private displayableSubWallets: AnySubWallet[] = null;
    public stakingAssets: StakingData[] = null;

    // Precomputed view-models consumed by the template (OnPush-friendly).
    public tokenRows: TokenRowViewModel[] = null;
    public nftRows: NftRowViewModel[] = [];
    public stakingRows: StakingRowViewModel[] = [];
    public balanceVm: BalanceViewModel = null;
    public hideBalances = false;

    // Figma Value screen groups holdings under Tokens / NFTs / Staked chips.
    public activeTab: 'tokens' | 'nfts' | 'staked' = 'tokens';
    public walletTabs: UiChip[] = [];

    public walletAddresses: WalletAddressInfo[] = null;

    public stakedBalance = null; // Staked on ELA main chain or Tron

    public refreshingStakedAssets = false;

    public isEVMNetworkWallet = true;

    public noAddressForLedgerWallet = false;

    private activeNetworkWalletSubscription: Subscription = null;
    private activeNetworkSubscription: Subscription = null;
    private subWalletsListChangeSubscription: Subscription = null;
    private stakedAssetsUpdateSubscription: Subscription = null;
    private currencyChangeSubscription: Subscription = null;

    // Helpers
    public WalletUtil = WalletUtil;
    public CoinType = CoinType;
    public SELA = Config.SELA;

    public hideRefresher = true;

    private updateInterval = null;

    // Dummy Current Network
    public currentNetwork: AnyNetwork = null;

    private sendTransactionSubscription: Subscription = null;

    // Titlebar
    private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

    private popover: HTMLIonPopoverElement = null;

    constructor(
        public native: Native,
        private popoverCtrl: PopoverController,
        public globalPopupService: GlobalPopupService,
        public walletManager: WalletService,
        public networkService: WalletNetworkService,
        private walletEditionService: WalletEditionService,
        private translate: TranslateService,
        public currencyService: CurrencyService,
        public theme: GlobalThemeService,
        public uiService: UiService,
        private walletNetworkUIService: WalletNetworkUIService,
        private walletUIService: WalletUIService,
        private storage: LocalStorage,
        private defiService: DefiService,
        private events: GlobalEvents,
        private zone: NgZone,
        private prefs: GlobalPreferencesService,
        private cdr: ChangeDetectorRef
    ) {
        GlobalFirebaseService.instance.logEvent("wallet_home_enter");
    }

    ngOnInit() {
        this.showRefresher();
        void this.loadHideBalances();

        // Re-render when the user toggles the native/fiat currency display.
        this.currencyChangeSubscription = this.currencyService.currencyChangedSubject.subscribe(() => {
            this.rebuildBalanceVm();
            this.rebuildTokenRows();
            this.rebuildStakingRows();
            this.cdr.markForCheck();
        });

        this.activeNetworkWalletSubscription = this.walletManager.activeNetworkWallet.subscribe((activeNetworkWallet) => {
            this.networkWallet = activeNetworkWallet;

            this.masterWallet = this.walletManager.getActiveMasterWallet();

            this.stakedBalance = null;

            if (activeNetworkWallet) {
                this.walletAddresses = this.networkWallet.getAddresses();

                this.checkLedgerWallet();

                this.isEVMNetworkWallet = this.networkWallet.getMainEvmSubWallet() ? true : false;

                this.refreshSubWalletsList();
                this.refreshStakingAssetsList();

                if (this.subWalletsListChangeSubscription) {
                    this.subWalletsListChangeSubscription.unsubscribe();
                }
                // Know when a subwallet is added or removed, to refresh our list
                this.subWalletsListChangeSubscription = this.networkWallet.subWalletsListChange.subscribe(() => {
                    this.refreshSubWalletsList();
                    this.cdr.markForCheck();
                });

                if (this.stakedAssetsUpdateSubscription) {
                    this.stakedAssetsUpdateSubscription.unsubscribe();
                }
                this.stakedAssetsUpdateSubscription = this.networkWallet.stakedAssetsUpdate.subscribe((data) => {
                    this.refreshStakingAssetsList();
                    this.cdr.markForCheck();
                })

                void this.updateCurrentWalletInfo()
            }
            else {
                this.checkLedgerWallet();
                // Nothing to do, unsupported wallet for the active network
            }
            this.rebuildBalanceVm();
            this.cdr.markForCheck();
        });

        // When switching network, if the current wallet does not support this network, you can still get the current network name.
        this.activeNetworkSubscription = this.networkService.activeNetwork.subscribe(activeNetwork => {
            this.currentNetwork = activeNetwork;
            this.checkLedgerWallet();
            this.cdr.markForCheck();
        });

        this.sendTransactionSubscription = this.events.subscribe("wallet:transactionpublished", () => {
            // Update balance and transactions.
            this.restartUpdateInterval();
            void this.updateCurrentWalletInfo();
        });
    }

    ngOnDestroy() {
        if (this.activeNetworkWalletSubscription) {
            this.activeNetworkWalletSubscription.unsubscribe();
            this.activeNetworkWalletSubscription = null;
        }

        if (this.activeNetworkSubscription) {
            this.activeNetworkSubscription.unsubscribe();
            this.activeNetworkSubscription = null;
        }

        if (this.subWalletsListChangeSubscription) {
            this.subWalletsListChangeSubscription.unsubscribe();
            this.subWalletsListChangeSubscription = null;
        }

        if (this.sendTransactionSubscription) {
            this.sendTransactionSubscription.unsubscribe();
            this.sendTransactionSubscription = null;
        }

        if (this.stakedAssetsUpdateSubscription) {
            this.stakedAssetsUpdateSubscription.unsubscribe();
            this.stakedAssetsUpdateSubscription = null;
        }

        if (this.currencyChangeSubscription) {
            this.currencyChangeSubscription.unsubscribe();
            this.currencyChangeSubscription = null;
        }
    }

    ionViewWillEnter() {
        // SCR-136 (reverted): do not force the shared CurrencyService.useCurrency
        // here — it is a persisted, app-wide setting and overriding it clobbered
        // the user's chosen crypto/fiat display. A fiat-first hero default must be
        // implemented locally without mutating global state. TODO(SCR-136): local default.
        if (!this.walletTabs.length) {
            this.walletTabs = [
                { key: 'tokens', label: this.translate.instant('wallet.tokens') },
                // SCR-137: dedicated short chip label ("NFTs"), not wallet.nfts ("Collectibles" list header).
                { key: 'nfts', label: this.translate.instant('wallet.nfts-chip') },
                { key: 'staked', label: this.translate.instant('staking.staked') }
            ];
            this.cdr.markForCheck();
        }
        this.titleBar.setTitle(this.translate.instant("wallet.value-title"));
        this.titleBar.setIcon(TitleBarIconSlot.OUTER_RIGHT, {
            key: "settings",
            iconPath: BuiltInIcon.SETTINGS
        });
        this.titleBar.addOnItemClickedListener(this.titleBarIconClickedListener = (icon) => {
            if (icon.key === 'settings') {
                this.native.go('/wallet/settings');
            }
        });
    }

    ionViewDidEnter() {
        if (this.walletManager.getMasterWalletsCount() > 0) {
            void this.promptTransfer2IDChain();
        }

        this.startUpdateInterval();

        GlobalStartupService.instance.setStartupScreenReady();
    }

    ionViewWillLeave() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
        if (this.native.popup) {
            this.native.popup.dismiss();
        }
    }

    private refreshSubWalletsList() {
        let sortType = this.uiService.getWalletSortType();
        this.displayableSubWallets = this.networkWallet.getSubWallets(sortType).filter(sw => sw.shouldShowOnHomeScreen());
        this.rebuildTokenRows();
        this.rebuildNftRows();
    }

    /** Precomputes a token row view-model per subwallet (keeps getters out of the template). */
    private rebuildTokenRows() {
        if (!this.displayableSubWallets) {
            this.tokenRows = null;
            return;
        }
        this.tokenRows = this.displayableSubWallets.map(sw => this.buildTokenRow(sw));
    }

    private buildTokenRow(subWallet: AnySubWallet): TokenRowViewModel {
        let fiatAmount = subWallet.getAmountInExternalCurrency(subWallet.getDisplayBalance());
        let symbol = this.currencyService.selectedCurrency.symbol;
        let title = this.uiService.getSubwalletTitle(subWallet);
        let balance = this.uiService.getFixedBalance(subWallet.getDisplayBalance());
        let pct = PriceHistoryService.instance.getPercentChange24h(
            subWallet.networkWallet.network.key, String(subWallet.id).toLowerCase());
        return {
            icon: subWallet.getMainIcon(),
            badge: subWallet.getSecondaryIcon(),
            title,
            native: `${balance} ${title}`,
            fiat: fiatAmount ? formatFiatAmount(fiatAmount.toNumber(), symbol) : null,
            changeSubValue: pct === null ? null : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
            tone: pct === null ? 'muted' : (pct >= 0 ? 'up' : 'down'),
            subWallet
        };
    }

    /** Precomputes a collectible row view-model per NFT (with a null-guarded main EVM subwallet icon). */
    private rebuildNftRows() {
        let nfts: NFT[] = this.networkWallet ? this.networkWallet.getNFTs() : [];
        let mainEvm = this.networkWallet ? this.networkWallet.getMainEvmSubWallet() : null;
        this.nftRows = (nfts || []).map(nft => ({
            icon: mainEvm ? mainEvm.getMainIcon() : null,
            badge: mainEvm ? mainEvm.getSecondaryIcon() : null,
            title: nft.name,
            sub: `${this.currentNetwork ? this.currentNetwork.getEffectiveName() : ''} ${nft.type} NFT`,
            count: nft.balance >= 0 ? `${nft.balance}` : '',
            nft
        }));
    }

    /** Precomputes the total-balance display (primary/secondary follow the currency toggle). */
    private rebuildBalanceVm() {
        if (!this.networkWallet) {
            this.balanceVm = null;
            return;
        }
        let nativeWhole = WalletUtil.getWholeBalance(this.networkWallet.getDisplayBalance());
        let nativeDecimals = WalletUtil.getDecimalBalance(this.networkWallet.getDisplayBalance(), this.networkWallet.getDecimalPlaces());
        let native = nativeDecimals ? `${nativeWhole}.${nativeDecimals}` : nativeWhole;

        let fiatWhole = WalletUtil.getWholeBalance(this.networkWallet.getDisplayBalanceInActiveCurrency());
        let fiatDecimals = WalletUtil.getDecimalBalance(this.networkWallet.getDisplayBalanceInActiveCurrency());
        let fiat = fiatDecimals ? `${fiatWhole}.${fiatDecimals}` : fiatWhole;

        let tokenName = this.networkWallet.getDisplayTokenName();
        let symbol = this.currencyService.selectedCurrency.symbol;

        let pnlData = PriceHistoryService.instance.getPortfolioPnl24h(this.networkWallet);
        let pnl = pnlData ? {
            text: `${pnlData.absCurrency >= 0 ? '+' : '-'}${formatFiatAmount(Math.abs(pnlData.absCurrency), symbol)} (${pnlData.pct.toFixed(1)}%)`,
            tone: (pnlData.absCurrency >= 0 ? 'up' : 'down') as 'up' | 'down'
        } : null;

        if (this.currencyService.useCurrency) {
            this.balanceVm = { primary: fiat, unit: symbol, secondary: `${native} ${tokenName}`, pnl };
        } else {
            this.balanceVm = { primary: native, unit: tokenName, secondary: `${fiat} ${symbol}`, pnl };
        }
    }

    private async loadHideBalances() {
        try {
            this.hideBalances = await this.prefs.getPreference(
                DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, 'ui.hidebalances');
            this.cdr.markForCheck();
        } catch (e) {
            this.hideBalances = false;
        }
    }

    public toggleHideBalances() {
        this.hideBalances = !this.hideBalances;
        void this.prefs.setPreference(
            DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, 'ui.hidebalances', this.hideBalances);
        this.cdr.markForCheck();
    }

    /** Toggle balance visibility from the balance hero without also triggering the currency toggle. */
    public onToggleHideBalances(event: Event) {
        event.stopPropagation();
        this.toggleHideBalances();
    }

    /** First character of the wallet name, for the header avatar disc (Figma initial avatar). */
    public get walletInitial(): string {
        return this.masterWallet && this.masterWallet.name ? this.masterWallet.name.trim().charAt(0).toUpperCase() : '?';
    }

    public async toggleCurrency() {
        // toggleCurrencyDisplay() flips useCurrency but does not emit currencyChangedSubject,
        // so under OnPush we rebuild the affected view-models and request a check ourselves.
        await this.currencyService.toggleCurrencyDisplay();
        this.rebuildBalanceVm();
        this.rebuildTokenRows();
        this.rebuildStakingRows();
        this.cdr.markForCheck();
    }

    /** The main token subwallet (Send/Receive/Swap/Stake land on its coin-home in v1). */
    public getMainSubWallet(): AnySubWallet {
        return this.networkWallet ? this.networkWallet.getMainTokenSubWallet() : null;
    }

    public onMainAction() {
        let main = this.getMainSubWallet();
        if (main) this.goCoinHome(main.networkWallet.id, main.id);
    }

    /** Send opens the 2026 token picker first, then the transfer form for the chosen token. */
    public onSend() {
        let main = this.getMainSubWallet();
        if (main) this.native.go('/wallet/coin-select-send', { masterWalletId: main.networkWallet.id });
    }

    public trackRow(_index: number, row: TokenRowViewModel): string {
        return row.subWallet.id;
    }

    public trackNft(_index: number, row: NftRowViewModel): string {
        return row.nft.contractAddress;
    }

    private refreshStakingAssetsList() {
        this.zone.run(() => {
            this.stakingAssets = this.networkWallet.getStakingAssets();
            this.rebuildStakingRows();
        })
    }

    /** Precomputes a staked-asset row per DeFi position (keeps getters out of the template). */
    private rebuildStakingRows() {
        this.stakingRows = (this.stakingAssets || []).map(asset => ({
            icon: asset.farmIconUrl,
            title: asset.farmName,
            fiat: `${this.usdToCurrencyAmount(String(asset.amountUSD))} ${this.currencyService.selectedCurrency.symbol}`,
            data: asset
        }));
    }

    public onTabChange(key: string) {
        this.activeTab = key as 'tokens' | 'nfts' | 'staked';
        this.cdr.markForCheck();
    }

    public trackStaking(_index: number, row: StakingRowViewModel): string {
        return row.data.farmUrl;
    }

    showRefresher() {
        setTimeout(() => {
            this.hideRefresher = false;
        }, 4000);
    }

    handleItem(key: string) {
        switch (key) {
            case 'settings':
                this.goToGeneralSettings();
                break;
        }
    }

    goToGeneralSettings() {
        this.native.go('/wallet/settings');

        // Not sure what this does but it throws an err using it
        // event.stopPropagation();
        return false;
    }

    goToWalletSettings(masterWallet: MasterWallet) {
        this.walletEditionService.modifiedMasterWalletId = masterWallet.id;
        this.native.go("/wallet/wallet-settings");
    }

    goCoinHome(masterWalletId: string, subWalletId: string) {
        this.native.go("/wallet/coin", { masterWalletId, subWalletId });
    }

    goSelectMasterWallet() {
        this.native.go("/wallet/wallet-manager");
    }

    public getPotentialActiveWallets(): AnyNetworkWallet[] {
        return this.walletManager.getNetworkWalletsList();
    }

    public hasStakingAssets() {
        if (!this.stakingAssets || this.stakingAssets.length === 0) {
            return false;
        }

        return true;
    }

    public usdToCurrencyAmount(balance: string, decimalplace = -1): string {
        if (!balance) {
            return '...';
        }

        if (decimalplace == -1) {
            decimalplace = this.currencyService.selectedCurrency.decimalplace;
        }

        let curerentAmount = this.currencyService.usdToCurrencyAmount(new BigNumber(balance));
        return curerentAmount.decimalPlaces(decimalplace).toFixed();
    }

    /**
     * Shows the wallet selector component to pick a different wallet
     */
    public pickOtherWallet() {
        void this.walletUIService.chooseActiveWallet();
    }

    /* public selectActiveWallet(wallet: AnyNetworkWallet) {
        void this.walletManager.setActiveNetworkWallet(wallet);
    } */

    public selectActiveNetwork(network: AnyNetwork) {
        // TODO: Use network object, not string
        void this.networkService.setActiveNetwork(network);
    }

    async updateCurrentWalletInfo() {
        if (this.networkWallet) {
            await this.getStakedBalance();
            await this.networkWallet.update();
            // TODO - FORCE REFRESH ALL COINS BALANCES ? this.currencyService.fetch();
            // Balances may have changed: recompute the presentation models under OnPush.
            this.rebuildBalanceVm();
            this.rebuildTokenRows();
            this.rebuildNftRows();
            this.cdr.markForCheck();
        }
    }

    startUpdateInterval() {
        if (this.updateInterval === null) {
            this.updateInterval = setInterval(() => {
                void this.updateCurrentWalletInfo();
            }, 30000);// 30s
        }
    }

    restartUpdateInterval() {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
        this.startUpdateInterval();
    }

    async doRefresh(event) {
        if (!this.uiService.returnedUser) {
            this.uiService.returnedUser = true;
            await this.storage.setVisit(true);
        }
        this.restartUpdateInterval();
        void this.updateCurrentWalletInfo();
        setTimeout(() => {
            event.target.complete();
        }, 1000);
    }

    async promptTransfer2IDChain() {
        if (this.walletManager.needToPromptTransferToIDChain) {
            void this.globalPopupService.ionicAlert('wallet.text-did-balance-not-enough');
            await this.walletManager.setHasPromptTransfer2IDChain();
        }
    }

    getWalletIndex(masterWallet: MasterWallet): number {
        return this.walletManager.getMasterWalletsList().indexOf(masterWallet);
    }

    isStandardSubwallet(subWallet: AnySubWallet) {
        return subWallet instanceof MainCoinSubWallet;
    }

    closeRefreshBox() {
        this.uiService.returnedUser = true;
        void this.storage.setVisit(true);
    }

    public goNFTHome(networkWallet: AnyNetworkWallet, nft: NFT) {
        this.native.go("/wallet/coin-nft-home", {
            masterWalletId: networkWallet.masterWallet.id,
            contractAddress: nft.contractAddress
        });
    }

    public viewTransactions(subWallet: AnySubWallet) {
        // Invoked from ui-token-row's (pressed) output, which carries no DOM event.
        this.goCoinHome(subWallet.networkWallet.id, subWallet.id)
    }

    public pickNetwork() {
        void this.walletNetworkUIService.chooseActiveNetwork();
    }

    public onStakingAssetClicked(stakingAsset: StakingData) {
        this.defiService.openStakeApp(stakingAsset);
    }

    public async onRefreshStakingAssetClicked() {
        this.zone.run(() => {
            this.refreshingStakedAssets = true;
            this.cdr.markForCheck();
        })

        await this.networkWallet.fetchStakingAssets();

        setTimeout(() => {
            this.zone.run(() => {
                this.refreshingStakedAssets = false;
                this.cdr.markForCheck();
            })
        }, 1000);
    }

    /**
     * Open tin.network in a browser view
     */
    public async openStakedAssetsProvider() {
        let mainEvm = this.networkWallet.getMainEvmSubWallet();
        if (!mainEvm) return;
        let walletAddress = await mainEvm.getAccountAddress();
        this.defiService.openStakedAssetsProvider(walletAddress);
    }

    public getDefaultStakedAssetIcon(): string {
        return this.networkWallet.network.logo;
    }

    public async setSortMode() {
        let sortType = this.uiService.getWalletSortType();
        let newSortType = WalletSortType.BALANCE;
        if (sortType === WalletSortType.BALANCE) {
            newSortType = WalletSortType.NAME;
        }
        await this.uiService.setWalletSortTtype(newSortType);

        this.refreshSubWalletsList();
        this.cdr.markForCheck();
    }

    private checkLedgerWallet() {
        this.noAddressForLedgerWallet = false;
        if (this.masterWallet && (this.masterWallet.type === WalletType.LEDGER)) {
            if (!this.masterWallet.supportsNetwork(this.networkService.activeNetwork.value)) {
                this.noAddressForLedgerWallet = true;
            }
        }
    }

    public getAddressFromLedger() {
        this.native.go("/wallet/ledger/scan", { device: (this.masterWallet as LedgerMasterWallet).deviceID, type: LedgerConnectType.AddAccount });
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
                let subwallet = this.networkWallet.getMainTokenSubWallet() as MainChainSubWallet;
                if (subwallet) {
                    this.stakedBalance = await subwallet.getStakedBalance();
                }
            } else if (this.networkWallet.network.key === 'tron') {
                let subwallet = this.networkWallet.getMainTokenSubWallet() as TronSubWallet;
                if (subwallet) {
                    this.stakedBalance = await subwallet.getStakedBalance();
                }
            }
        }
    }

    public getStakedBalanceInNative() {
        return WalletUtil.getFriendlyBalance(new BigNumber(this.stakedBalance));
    }

    public getStakedBalanceInCurrency() {
        let balance = CurrencyService.instance.getMainTokenValue(new BigNumber(this.stakedBalance),
            this.networkWallet.network, this.currencyService.selectedCurrency.symbol);
        return WalletUtil.getFriendlyBalance(balance);
    }

    public async pickWalletAddress(event) {
      event.preventDefault();
      event.stopPropagation();

      this.popover = await this.popoverCtrl.create({
        mode: 'ios',
        component: WalletAddressChooserComponent,
        componentProps: {
          addresses: this.walletAddresses
        },
        cssClass: !this.theme.activeTheme.value.config.usesDarkMode ? 'launcher-address-chooser-component' : 'launcher-address-chooser-component-dark',
        event: event,
        translucent: false
      });
      void this.popover.onWillDismiss().then((resp) => {
        this.popover = null;
      });
      return await this.popover.present();
    }

    public getReducedWalletAddress(address: string) {
      return reducedWalletAddress(address);
    }

    /**
     * Copies the first and only wallet address for the active wallet.
     * Address is copied to the clipboard and a toast confirmation is shown.
     */
    public copySingleAddressToClipboard(event, address: string) {
      event.preventDefault();
      event.stopPropagation();

      let confirmationMessage = this.translate.instant('common.copied-to-clipboard');
      this.native.toast(confirmationMessage);
      void this.native.copyClipboard(address);
    }

    public canSwitchWallet() {
        if (!this.networkWallet) {
            // The activity wallet does not support the current network,
            // but users can choose to switch to another wallet
            return this.getPotentialActiveWallets().length >= 1
        } else {
            return this.getPotentialActiveWallets().length > 1
        }
    }
}
