import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Logger } from 'src/app/logger';
import { AggregatedTokenRow } from '../model/aggregated-token';
import { AnyNetworkWallet } from '../model/networks/base/networkwallets/networkwallet';
import { AnySubWallet } from '../model/networks/base/subwallets/subwallet';
import { ERC20SubWallet } from '../model/networks/evms/subwallets/erc20.subwallet';
import { AnyNetwork } from '../model/networks/network';
import { CurrencyService } from './currency.service';
import { WalletNetworkService } from './network.service';
import { PortfolioPnl, PriceHistoryService } from './pricehistory.service';
import { WalletService } from './wallet.service';

/** The networks merged into the all-chains view (v1; extension point for more). */
const TARGET_NETWORK_KEYS = ['elastos', 'elastossmartchain', 'ethereum', 'elastosecopgp'];

/** The four always-visible ELA instruments. EID is deliberately excluded for now. */
const DEFAULT_ELA_ERC20_BY_NETWORK: { [networkKey: string]: string } = {
  ethereum: '0xe6fd75ff38adca4b97fbcd938c86b98772431867', // ELA on Ethereum
  elastosecopgp: '0x0000000000000000000000000000000000000065' // ELA on PGP
};
const DEFAULT_ELA_NATIVE_NETWORK_KEYS = ['elastos', 'elastossmartchain'];

/**
 * On-device all-chains balance aggregator. For the active master wallet it keeps
 * one lightweight NetworkWallet per target network (created WITHOUT background
 * updates: subwallets load their disk-cached balances instantly, no timers, no
 * transaction providers) and merges their token lists into a single row stream.
 *
 * Everything is local: cached balances render immediately, refresh() performs the
 * same per-subwallet RPC balance calls the app already uses, nothing remote is
 * aggregated for us.
 */
@Injectable({
  providedIn: 'root'
})
export class AggregatedTokensService {
  public static instance: AggregatedTokensService = null;

  /** null until the first build for a master wallet completes; then always the current merged rows. */
  public rows = new BehaviorSubject<AggregatedTokenRow[]>(null);

  private instances = new Map<string, AnyNetworkWallet>(); // network key -> instance
  private builtForMasterId: string = null;
  private building: Promise<void> = null;
  private refreshing = false;
  private activeWalletSub: Subscription = null;

  constructor(
    private walletService: WalletService,
    private networkService: WalletNetworkService
  ) {
    AggregatedTokensService.instance = this;

    // Rebuild for the new master wallet; clear on sign-out (active wallet becomes null).
    this.activeWalletSub = this.walletService.activeNetworkWallet.subscribe(nw => {
      const masterId = nw ? nw.masterWallet.id : null;
      if (!masterId) {
        this.clear();
      } else if (this.builtForMasterId && this.builtForMasterId !== masterId) {
        this.clear();
        void this.ensureBuilt();
      }
    });
  }

  private clear() {
    // Side instances never started background updates, so there is nothing to stop;
    // dropping the references releases them.
    this.instances.clear();
    this.builtForMasterId = null;
    this.rows.next(null);
  }

  /**
   * Builds (once per master wallet) the per-network instances and emits the first
   * rows from cached balances. Safe to call repeatedly.
   */
  public ensureBuilt(): Promise<void> {
    const activeNw = this.walletService.activeNetworkWallet.value;
    if (!activeNw) return Promise.resolve();
    if (this.builtForMasterId === activeNw.masterWallet.id) return this.building || Promise.resolve();

    this.building = this.build(activeNw);
    return this.building;
  }

  private async build(activeNw: AnyNetworkWallet): Promise<void> {
    const masterId = activeNw.masterWallet.id;
    this.builtForMasterId = masterId;
    this.instances.clear();

    for (const key of TARGET_NETWORK_KEYS) {
      const network = this.networkService.getNetworkByKey(key);
      if (!network) continue; // network not registered on this template (e.g. testnet)

      try {
        // Reuse the wallet service's live instance when this network is the active
        // one (avoids a duplicate SPV mainchain instance); side instances otherwise.
        if (this.networkService.activeNetwork.value?.key === key) {
          const shared = this.walletService.getNetworkWalletFromMasterWalletId(masterId);
          if (shared) {
            this.instances.set(key, shared);
            continue;
          }
        }
        const instance = await this.walletService.newNetworkWalletInstance(masterId, network);
        this.instances.set(key, instance);
      } catch (e) {
        // SPV/native errors (e.g. wallet needs the pay password) must never surface
        // from the aggregator; the network is skipped this round and retried later.
        Logger.warn('wallet', 'AggregatedTokens: skipping network', key, e);
      }
    }

    this.emitRows();
  }

  /** Recomputes and emits the merged, filtered, sorted rows from current subwallet state. */
  public emitRows() {
    if (this.instances.size === 0) return;
    this.rows.next(this.assembleRows());
  }

  private assembleRows(): AggregatedTokenRow[] {
    const rows: AggregatedTokenRow[] = [];

    for (const [key, nw] of this.instances) {
      const network = nw.network as AnyNetwork;
      for (const sw of nw.getSubWallets()) {
        if (!sw.shouldShowOnHomeScreen()) continue;

        const isDefaultEla = this.isDefaultElaInstrument(key, sw);
        const balance = sw.getBalance();
        const hasBalance = !balance.isNaN() && balance.gt(0);
        if (!isDefaultEla && !hasBalance) continue; // non-defaults only appear with a balance

        rows.push({
          subWallet: sw,
          network,
          isDefaultEla,
          hasValue: !balance.isNaN()
        });
      }
    }

    return this.sortRows(rows);
  }

  /** Balance-holding rows first (USD desc, unpriced after priced), then zero-balance defaults in fixed chain order. */
  private sortRows(rows: AggregatedTokenRow[]): AggregatedTokenRow[] {
    const defaultOrder = (row: AggregatedTokenRow) => TARGET_NETWORK_KEYS.indexOf(row.network.key);

    const funded = rows.filter(r => !r.subWallet.getBalance().isNaN() && r.subWallet.getBalance().gt(0));
    const empty = rows.filter(r => !funded.includes(r));

    funded.sort((a, b) => {
      const usdA = a.subWallet.getUSDBalance();
      const usdB = b.subWallet.getUSDBalance();
      const aPriced = !usdA.isNaN() && usdA.gt(0);
      const bPriced = !usdB.isNaN() && usdB.gt(0);
      if (aPriced && bPriced) return usdB.comparedTo(usdA);
      if (aPriced !== bPriced) return aPriced ? -1 : 1;
      return b.subWallet.getBalance().comparedTo(a.subWallet.getBalance());
    });

    empty.sort((a, b) => defaultOrder(a) - defaultOrder(b));

    return [...funded, ...empty];
  }

  private isDefaultElaInstrument(networkKey: string, sw: AnySubWallet): boolean {
    if (DEFAULT_ELA_NATIVE_NETWORK_KEYS.includes(networkKey)) {
      // The network's native coin subwallet IS the ELA instrument on these chains.
      return sw.isStandardSubWallet();
    }
    const elaContract = DEFAULT_ELA_ERC20_BY_NETWORK[networkKey];
    if (!elaContract) return false;
    return sw instanceof ERC20SubWallet && sw.coin?.getContractAddress()?.toLowerCase() === elaContract;
  }

  /**
   * Refreshes balances (and missing ERC20 prices) network by network, emitting
   * rows progressively as each network completes. No timers are armed here.
   */
  public async refresh(): Promise<void> {
    if (this.refreshing) return;
    await this.ensureBuilt();
    if (this.instances.size === 0) return;

    this.refreshing = true;
    try {
      // Each per-network task swallows its own errors, so Promise.all cannot reject.
      await Promise.all(
        Array.from(this.instances.entries()).map(async ([key, nw]) => {
          try {
            for (const sw of nw.getSubWallets()) {
              if (!sw.shouldShowOnHomeScreen()) continue;
              await sw.updateBalance();
              if (sw instanceof ERC20SubWallet && !sw.getBalance().isNaN() && sw.getBalance().gt(0)) {
                await CurrencyService.instance.fetchERC20TokenValue(sw.coin, nw.network);
              }
            }
          } catch (e) {
            Logger.warn('wallet', 'AggregatedTokens: refresh failed for', key, e);
          }
          this.emitRows(); // progressive: each finished network updates the list
        })
      );
    } finally {
      this.refreshing = false;
    }
  }

  /** Whole-portfolio fiat total across the target networks, in the active display currency. NaN-safe; null when nothing is known yet. */
  public getAggregateFiatTotal(): BigNumber {
    let total = new BigNumber(0);
    let known = false;
    for (const nw of this.instances.values()) {
      const value = nw.getDisplayBalanceInActiveCurrency();
      if (!value.isNaN()) {
        known = true;
        total = total.plus(value);
      }
    }
    return known ? total : new BigNumber(NaN);
  }

  /** Sums the local 24h PnL across networks that have enough price history; null when none do. */
  public getAggregatePnl24h(): PortfolioPnl {
    let absUSD = 0;
    let absCurrency = 0;
    let baseUSD = 0;
    let any = false;
    for (const nw of this.instances.values()) {
      const pnl = PriceHistoryService.instance.getPortfolioPnl24h(nw);
      if (!pnl) continue;
      any = true;
      absUSD += pnl.absUSD;
      absCurrency += pnl.absCurrency;
      // Reconstruct each network's base value to derive the aggregate percentage.
      if (pnl.pct !== 0) baseUSD += pnl.absUSD / (pnl.pct / 100);
    }
    if (!any) return null;
    const pct = baseUSD !== 0 ? (absUSD / baseUSD) * 100 : 0;
    return { absUSD, absCurrency, pct };
  }
}
