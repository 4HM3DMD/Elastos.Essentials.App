import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Logger } from 'src/app/logger';
import { AggregatedTokenRow, ReceiveTarget } from '../model/aggregated-token';
import { AnyNetworkWallet } from '../model/networks/base/networkwallets/networkwallet';
import { AnySubWallet } from '../model/networks/base/subwallets/subwallet';
import { ERC20SubWallet } from '../model/networks/evms/subwallets/erc20.subwallet';
import { AnyNetwork } from '../model/networks/network';
import { CurrencyService } from './currency.service';
import { WalletNetworkService } from './network.service';
import { PortfolioPnl, PriceHistoryService } from './pricehistory.service';
import { WalletService } from './wallet.service';

/** Refresh-priority networks and the fixed order for the zero-balance default rows. */
const DEFAULT_NETWORK_ORDER = ['elastos', 'elastossmartchain', 'ethereum', 'elastosecopgp'];

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
  private lastFullSweepAt = 0; // epoch ms of the last discovery sweep (0 = never)
  private failedNetworkKeys: string[] = []; // side-instance creation failures, retried on refresh
  private buildGeneration = 0; // invalidates in-flight builds on clear/rebuild
  private buildRequested = false; // ensureBuilt was called before any wallet existed
  private sharedInstanceKey: string = null; // which network key borrows the wallet service's live instance
  private activeWalletSub: Subscription = null;
  private activeNetworkSub: Subscription = null;

  constructor(
    private walletService: WalletService,
    private networkService: WalletNetworkService
  ) {
    AggregatedTokensService.instance = this;

    // Rebuild for the new master wallet; clear on sign-out (active wallet becomes
    // null); serve a build that was requested before the first wallet was ready.
    this.activeWalletSub = this.walletService.activeNetworkWallet.subscribe(nw => {
      const masterId = nw ? nw.masterWallet.id : null;
      if (!masterId) {
        this.clear();
      } else if (this.builtForMasterId && this.builtForMasterId !== masterId) {
        this.clear();
        void this.ensureBuilt();
      } else if (!this.builtForMasterId && this.buildRequested) {
        void this.ensureBuilt();
      }
    });

    // On active-network switches the wallet service terminates and rebuilds its
    // instances: adopt the fresh live one for the new key and give the previous
    // key its own side instance, so the map never holds terminated wallets.
    this.activeNetworkSub = this.networkService.activeNetwork.subscribe(() => {
      void this.onActiveNetworkChanged();
    });
  }

  private async onActiveNetworkChanged() {
    if (!this.builtForMasterId) return;
    const gen = this.buildGeneration;
    const masterId = this.builtForMasterId;
    const activeKey = this.networkService.activeNetwork.value?.key;
    if (!activeKey || this.sharedInstanceKey === activeKey) return;

    try {
      // The previous borrower's live instance was terminated by the wallet
      // service during the switch: give that key its own fresh side instance.
      const previousKey = this.sharedInstanceKey;
      if (previousKey && this.instances.has(previousKey)) {
        const network = this.networkService.getNetworkByKey(previousKey);
        if (network) {
          const side = await this.walletService.newNetworkWalletInstance(masterId, network);
          if (gen !== this.buildGeneration) return;
          this.instances.set(previousKey, side);
        }
      }

      // Adopt the wallet service's fresh live instance for the new active key
      // (never keep a duplicate side instance beside it, esp. SPV mainchain).
      const shared = this.walletService.getNetworkWalletFromMasterWalletId(masterId);
      if (shared && this.instances.has(activeKey) && gen === this.buildGeneration) {
        this.instances.set(activeKey, shared);
        this.sharedInstanceKey = activeKey;
      }
    } catch (e) {
      Logger.warn('wallet', 'AggregatedTokens: instance swap failed', e);
    }
    if (gen === this.buildGeneration) this.emitRows();
  }

  private clear() {
    // Side instances never started background updates, so there is nothing to stop;
    // dropping the references releases them.
    this.buildGeneration++;
    this.instances.clear();
    this.builtForMasterId = null;
    this.sharedInstanceKey = null;
    this.lastFullSweepAt = 0;
    this.failedNetworkKeys = [];
    this.rows.next(null);
  }

  /**
   * Builds (once per master wallet) the per-network instances and emits the first
   * rows from cached balances. Safe to call repeatedly.
   */
  public ensureBuilt(): Promise<void> {
    const activeNw = this.walletService.activeNetworkWallet.value;
    if (!activeNw) {
      // Wallets not ready yet: remember the request; the subscription builds later.
      this.buildRequested = true;
      return Promise.resolve();
    }
    this.buildRequested = false;
    if (this.builtForMasterId === activeNw.masterWallet.id) return this.building || Promise.resolve();

    this.building = this.build(activeNw);
    return this.building;
  }

  private async build(activeNw: AnyNetworkWallet): Promise<void> {
    const masterId = activeNw.masterWallet.id;
    const gen = ++this.buildGeneration;
    this.builtForMasterId = masterId;
    this.instances.clear();
    this.failedNetworkKeys = [];

    // Every visible network participates: default ELA chains always show their rows,
    // any other network contributes assets once a balance exists.
    for (const network of this.networkService.getDisplayableNetworks()) {
      const key = network.key;
      try {
        // Reuse the wallet service's live instance when this network is the active
        // one (avoids a duplicate SPV mainchain instance); side instances otherwise.
        if (this.networkService.activeNetwork.value?.key === key) {
          const shared = this.walletService.getNetworkWalletFromMasterWalletId(masterId);
          if (shared) {
            if (gen !== this.buildGeneration) return; // superseded mid-build
            this.instances.set(key, shared);
            this.sharedInstanceKey = key;
            continue;
          }
        }
        const instance = await this.walletService.newNetworkWalletInstance(masterId, network);
        if (gen !== this.buildGeneration) return; // superseded mid-build
        this.instances.set(key, instance);
      } catch (e) {
        // SPV/native errors (e.g. wallet needs the pay password) must never surface
        // from the aggregator; the network is skipped and retried on later refreshes.
        Logger.warn('wallet', 'AggregatedTokens: skipping network', key, e);
        this.failedNetworkKeys.push(key);
      }
    }

    if (gen === this.buildGeneration) this.emitRows();
  }

  /** Retries side-instance creation for networks that failed during build. */
  private async retryFailedNetworks() {
    if (!this.builtForMasterId || this.failedNetworkKeys.length === 0) return;
    const gen = this.buildGeneration;
    const keys = this.failedNetworkKeys;
    this.failedNetworkKeys = [];
    for (const key of keys) {
      try {
        const network = this.networkService.getNetworkByKey(key);
        if (!network) continue;
        const instance = await this.walletService.newNetworkWalletInstance(this.builtForMasterId, network);
        if (gen !== this.buildGeneration) return;
        this.instances.set(key, instance);
      } catch (e) {
        if (gen === this.buildGeneration) this.failedNetworkKeys.push(key);
      }
    }
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
  private hasKnownBalance(nw: AnyNetworkWallet): boolean {
    return nw.getSubWallets().some(sw =>
      sw.shouldShowOnHomeScreen() && !sw.getBalance().isNaN() && sw.getBalance().gt(0));
  }

  /** The Elastos mainchain instance (staking lives there), if built. */
  public getMainchainInstance(): AnyNetworkWallet {
    return this.instances.get('elastos') || null;
  }

  /** The built side-instance for a chain, if any. Used by coin-receive to show a chosen
   *  chain's address without switching the app's active network. */
  public getInstanceByKey(networkKey: string): AnyNetworkWallet {
    return this.instances.get(networkKey) || null;
  }

  /**
   * The receivable chains for the multi-chain Receive page. One entry per built
   * side-instance that exposes a main-token subwallet and a derivable address (a
   * chain address receives every token on that chain, so no per-token choice is
   * needed). Elastos-ecosystem chains come first in the fixed default order, then
   * the rest alphabetically. Nothing here touches the active network.
   */
  public getReceiveTargets(): ReceiveTarget[] {
    const orderOf = (key: string) => {
      const i = DEFAULT_NETWORK_ORDER.indexOf(key);
      return i === -1 ? DEFAULT_NETWORK_ORDER.length : i;
    };

    const targets: ReceiveTarget[] = [];
    for (const [, nw] of this.instances) {
      const mainSubWallet = nw.getMainTokenSubWallet();
      if (!mainSubWallet) continue;
      const addresses = nw.getAddresses();
      const address = addresses && addresses.length > 0 ? addresses[0].address : null;
      if (!address) continue; // a chain with no derivable address cannot receive
      targets.push({ network: nw.network as AnyNetwork, networkWallet: nw, mainSubWallet, address });
    }

    targets.sort((a, b) => {
      const byOrder = orderOf(a.network.key) - orderOf(b.network.key);
      if (byOrder !== 0) return byOrder;
      return a.network.getEffectiveName().localeCompare(b.network.getEffectiveName());
    });
    return targets;
  }

  private sortRows(rows: AggregatedTokenRow[]): AggregatedTokenRow[] {
    const defaultOrder = (row: AggregatedTokenRow) => DEFAULT_NETWORK_ORDER.indexOf(row.network.key);

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
    this.refreshing = true; // set before any await so concurrent callers bail
    try {
      await this.ensureBuilt();
      await this.retryFailedNetworks();
    } catch (e) {
      this.refreshing = false;
      throw e;
    }
    if (this.instances.size === 0) {
      this.refreshing = false;
      return;
    }

    // Bounded refresh: the default chains and funded networks every cycle; a full
    // discovery sweep periodically so balances received later still get learned.
    const FULL_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
    const fullSweep = Date.now() - this.lastFullSweepAt > FULL_SWEEP_INTERVAL_MS;
    if (fullSweep) this.lastFullSweepAt = Date.now();
    const entries = Array.from(this.instances.entries()).filter(([key, nw]) =>
      fullSweep || DEFAULT_NETWORK_ORDER.includes(key) || this.hasKnownBalance(nw));
    try {
      // Each per-network task swallows its own errors, so Promise.all cannot reject.
      await Promise.all(
        entries.map(async ([key, nw]) => {
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
    let any = false;
    for (const nw of this.instances.values()) {
      const pnl = PriceHistoryService.instance.getPortfolioPnl24h(nw);
      if (!pnl) continue;
      any = true;
      absUSD += pnl.absUSD;
      absCurrency += pnl.absCurrency;
    }
    if (!any) return null;
    // Percentage against the WHOLE portfolio (networks without history included),
    // so a small mover on one chain cannot masquerade as a portfolio-wide move.
    const total = this.getAggregateFiatTotal();
    const base = !total.isNaN() ? total.toNumber() - absCurrency : 0;
    const pct = base > 0 ? (absCurrency / base) * 100 : 0;
    return { absUSD, absCurrency, pct };
  }
}
