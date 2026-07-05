import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { Observable, Subscription } from 'rxjs';
import { Logger } from 'src/app/logger';
import { AnyNetworkWallet } from '../model/networks/base/networkwallets/networkwallet';
import { AnySubWallet } from '../model/networks/base/subwallets/subwallet';
import { TimeBasedPersistentCache } from '../model/timebasedpersistentcache';
import { CurrencyService } from './currency.service';

/**
 * One recorded price sample. Declared as a `type` (not an interface) so it satisfies
 * TimeBasedPersistentCache's `T extends JSONObject` bound via an implicit index signature.
 * `t` is an epoch time in SECONDS, `p` is the price in USD (currency-independent).
 */
export type PricePoint = { t: number; p: number };

/** How often (at most) a token's price is snapshotted. Decoupled from the 30s UI refresh. */
const RECORD_INTERVAL_MS = 15 * 60 * 1000;
const FINE_MAX_ITEMS = 400;
const DAILY_MAX_ITEMS = 400;

const DAY_SECONDS = 86400;
const HOUR_SECONDS = 3600;
const FINE_BUCKET_SECONDS = 15 * 60; // one fine point per 15 minutes
const FINE_HOURLY_AFTER = 48 * HOUR_SECONDS; // beyond 48h, keep one fine point per hour
const FINE_RETAIN = 7 * DAY_SECONDS; // fine cache keeps at most 7 days
const DAILY_RETAIN = 366 * DAY_SECONDS; // daily cache keeps ~1 year
const ANCHOR_TOLERANCE_SECONDS = 90 * 60; // 24h anchor must be within +/-90 min

const RANGE_SECONDS: { [range: string]: number } = {
  '1D': DAY_SECONDS,
  '1W': 7 * DAY_SECONDS,
  '1M': 30 * DAY_SECONDS,
  '1Y': 365 * DAY_SECONDS
};

export type ChartRange = '1D' | '1W' | '1M' | '1Y';

export interface PortfolioPnl {
  absUSD: number;
  absCurrency: number;
  pct: number;
}

/**
 * Records token prices on-device over time (LOCAL only — no remote 24h-change API) and derives
 * 24h %change, portfolio PnL and chart series from that history. Prices are stored in USD and
 * converted to the selected currency at read time. History accrues only while the app is open, so
 * every selector returns null when history is insufficient — consumers must render nothing rather
 * than fabricate a value.
 */
@Injectable({ providedIn: 'root' })
export class PriceHistoryService {
  public static instance: PriceHistoryService = null;

  // Single owning cache instance per token so a stale parallel copy can never shadow disk.
  private fineCaches = new Map<string, TimeBasedPersistentCache<PricePoint>>();
  private dailyCaches = new Map<string, TimeBasedPersistentCache<PricePoint>>();
  private fineCacheLoads = new Map<string, Promise<TimeBasedPersistentCache<PricePoint>>>();
  private dailyCacheLoads = new Map<string, Promise<TimeBasedPersistentCache<PricePoint>>>();

  private lastRecordedAt = new Map<string, number>(); // ms, keyed networkKey-tokenId

  private activeWallet: AnyNetworkWallet = null;
  private activeWalletSub: Subscription = null;
  private recordTimer: ReturnType<typeof setInterval> = null;
  private started = false;

  constructor() {
    PriceHistoryService.instance = this;
  }

  /** Starts recording. WalletService passes its active-wallet stream to avoid a circular import. */
  public init(activeWallet$: Observable<AnyNetworkWallet>): Promise<void> {
    if (this.started) return Promise.resolve();
    this.started = true;

    this.activeWalletSub = activeWallet$.subscribe(networkWallet => {
      this.activeWallet = networkWallet;
      void this.recordVisible(networkWallet);
    });

    this.recordTimer = setInterval(() => {
      void this.recordVisible(this.activeWallet);
    }, RECORD_INTERVAL_MS);

    return Promise.resolve();
  }

  public stop(): void {
    if (this.activeWalletSub) {
      this.activeWalletSub.unsubscribe();
      this.activeWalletSub = null;
    }
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    this.started = false;
  }

  /* ----------------------------- Recording ----------------------------- */

  /** Snapshots the current USD price of each displayable token in a network wallet (no network fetch). */
  public async recordVisible(networkWallet: AnyNetworkWallet): Promise<void> {
    if (!networkWallet) return;
    let networkKey = networkWallet.network.key;
    for (let subWallet of networkWallet.getSubWallets()) {
      if (!subWallet.shouldShowOnHomeScreen()) continue;
      let usd = this.readUsdPrice(subWallet);
      if (usd === null) continue;
      await this.recordSnapshot(networkKey, this.tokenId(subWallet), usd);
    }
  }

  /** Reads a subwallet's cached USD unit price, or null when unavailable. Never triggers a fetch. */
  private readUsdPrice(subWallet: AnySubWallet): number | null {
    try {
      let value = subWallet.getOneCoinUSDValue();
      if (!value || value.isNaN()) return null;
      let num = value.toNumber();
      return num > 0 ? num : null;
    } catch (e) {
      return null;
    }
  }

  private tokenId(subWallet: AnySubWallet): string {
    return String(subWallet.id || '').toLowerCase();
  }

  /** Appends a price point (throttled to RECORD_INTERVAL_MS) and downsamples older history. */
  public async recordSnapshot(networkKey: string, tokenId: string, priceUSD: number,
    atSeconds: number = Math.floor(Date.now() / 1000)): Promise<void> {
    if (!(priceUSD > 0) || !tokenId) return;

    let mapKey = `${networkKey}-${tokenId}`;
    let nowMs = atSeconds * 1000;
    let lastMs = this.lastRecordedAt.get(mapKey) || 0;
    if (nowMs - lastMs < RECORD_INTERVAL_MS) return;
    this.lastRecordedAt.set(mapKey, nowMs);

    try {
      let fine = await this.getFineCache(networkKey, tokenId);
      let bucket = Math.floor(atSeconds / FINE_BUCKET_SECONDS) * FINE_BUCKET_SECONDS;
      fine.set(String(bucket), { t: bucket, p: priceUSD }, bucket);
      this.compactFine(fine, atSeconds);
      await fine.save();

      // One daily point per UTC day, for the 1M / 1Y ranges.
      let daily = await this.getDailyCache(networkKey, tokenId);
      let dayBucket = Math.floor(atSeconds / DAY_SECONDS) * DAY_SECONDS;
      if (!daily.get(String(dayBucket))) {
        daily.set(String(dayBucket), { t: dayBucket, p: priceUSD }, dayBucket);
        this.compactDaily(daily, atSeconds);
        await daily.save();
      }
    } catch (e) {
      Logger.warn('wallet', 'PriceHistoryService: failed to record snapshot', e);
    }
  }

  /** Drops fine points older than 7 days and thins 48h..7d down to one per clock-hour. */
  private compactFine(cache: TimeBasedPersistentCache<PricePoint>, nowSeconds: number): void {
    let cutoffRetain = nowSeconds - FINE_RETAIN;
    let cutoffHourly = nowSeconds - FINE_HOURLY_AFTER;
    let seenHours = new Set<number>();
    for (let entry of [...cache.values()]) {
      let t = entry.data.t;
      if (t < cutoffRetain) {
        cache.remove(entry.key);
        continue;
      }
      if (t < cutoffHourly) {
        let hour = Math.floor(t / HOUR_SECONDS);
        if (seenHours.has(hour)) cache.remove(entry.key);
        else seenHours.add(hour);
      }
    }
  }

  /** Drops daily points older than ~1 year. */
  private compactDaily(cache: TimeBasedPersistentCache<PricePoint>, nowSeconds: number): void {
    let cutoff = nowSeconds - DAILY_RETAIN;
    for (let entry of [...cache.values()]) {
      if (entry.data.t < cutoff) cache.remove(entry.key);
    }
  }

  /* -------------------------- Cache accessors -------------------------- */

  private getFineCache(networkKey: string, tokenId: string): Promise<TimeBasedPersistentCache<PricePoint>> {
    return this.loadCache(this.fineCaches, this.fineCacheLoads, `phist-${networkKey}-${tokenId}`, `${networkKey}-${tokenId}`, FINE_MAX_ITEMS);
  }

  private getDailyCache(networkKey: string, tokenId: string): Promise<TimeBasedPersistentCache<PricePoint>> {
    return this.loadCache(this.dailyCaches, this.dailyCacheLoads, `phistd-${networkKey}-${tokenId}`, `${networkKey}-${tokenId}`, DAILY_MAX_ITEMS);
  }

  private loadCache(
    resolved: Map<string, TimeBasedPersistentCache<PricePoint>>,
    loading: Map<string, Promise<TimeBasedPersistentCache<PricePoint>>>,
    diskName: string, mapKey: string, maxItems: number
  ): Promise<TimeBasedPersistentCache<PricePoint>> {
    let existing = resolved.get(mapKey);
    if (existing) return Promise.resolve(existing);
    let inFlight = loading.get(mapKey);
    if (inFlight) return inFlight;
    let p = TimeBasedPersistentCache.loadOrCreate<PricePoint>(diskName, true, maxItems).then(cache => {
      resolved.set(mapKey, cache);
      loading.delete(mapKey);
      return cache;
    });
    loading.set(mapKey, p);
    return p;
  }

  /* ----------------------------- Selectors ----------------------------- */

  /**
   * Latest price and the sample nearest 24h ago (within a bounded tolerance), or null when history
   * is insufficient. Lazily loads the cache if it isn't in memory yet, returning null until it is.
   */
  private getAnchor24h(networkKey: string, tokenId: string): { latest: number; ref: number } | null {
    let mapKey = `${networkKey}-${tokenId}`;
    let cache = this.fineCaches.get(mapKey);
    if (!cache) {
      void this.getFineCache(networkKey, tokenId);
      return null;
    }
    let points = cache.values(); // newest first
    if (points.length < 2) return null;

    let latest = points[0].data;
    let target = latest.t - DAY_SECONDS;
    let best: PricePoint = null;
    let bestDist = Infinity;
    for (let entry of points) {
      let dist = Math.abs(entry.data.t - target);
      if (dist <= ANCHOR_TOLERANCE_SECONDS && dist < bestDist) {
        best = entry.data;
        bestDist = dist;
      }
    }
    if (!best || !(best.p > 0) || !(latest.p > 0)) return null;
    return { latest: latest.p, ref: best.p };
  }

  /** 24h price change as a percentage, or null when there is no valid 24h anchor. */
  public getPercentChange24h(networkKey: string, tokenId: string): number | null {
    let anchor = this.getAnchor24h(networkKey, tokenId);
    if (!anchor) return null;
    return ((anchor.latest - anchor.ref) / anchor.ref) * 100;
  }

  /**
   * Portfolio 24h PnL summed over held tokens that have a valid 24h anchor. Tokens without an anchor
   * are skipped (never treated as zero). Returns null when no token qualifies or the total is unusable.
   */
  public getPortfolioPnl24h(networkWallet: AnyNetworkWallet): PortfolioPnl | null {
    if (!networkWallet) return null;
    let networkKey = networkWallet.network.key;
    let absUSD = 0;
    let prevUSD = 0;
    let qualified = false;

    for (let subWallet of networkWallet.getSubWallets()) {
      if (!subWallet.shouldShowOnHomeScreen()) continue;
      let anchor = this.getAnchor24h(networkKey, this.tokenId(subWallet));
      if (!anchor) continue;
      let balance = subWallet.getDisplayBalance();
      if (!balance || balance.isNaN()) continue;
      let bal = balance.toNumber();
      if (!(bal > 0)) continue;
      absUSD += bal * (anchor.latest - anchor.ref);
      prevUSD += bal * anchor.ref;
      qualified = true;
    }

    if (!qualified || !(prevUSD > 0)) return null;
    let pct = (absUSD / prevUSD) * 100;
    let absCurrency = CurrencyService.instance.usdToCurrencyAmount(new BigNumber(absUSD)).toNumber();
    return { absUSD, absCurrency, pct };
  }

  /**
   * A price series (oldest -> newest) for a chart range, or null when fewer than two points exist.
   * Reads only in-memory caches; lazily loads and returns null on the first miss.
   */
  public getSeries(networkKey: string, tokenId: string, range: ChartRange): number[] | null {
    let useDaily = range === '1M' || range === '1Y';
    let mapKey = `${networkKey}-${tokenId}`;
    let cache = useDaily ? this.dailyCaches.get(mapKey) : this.fineCaches.get(mapKey);
    if (!cache) {
      if (useDaily) void this.getDailyCache(networkKey, tokenId);
      else void this.getFineCache(networkKey, tokenId);
      return null;
    }

    let now = Math.floor(Date.now() / 1000);
    let cutoff = now - RANGE_SECONDS[range];
    let points = cache.values()
      .filter(entry => entry.data.t >= cutoff)
      .map(entry => entry.data)
      .sort((a, b) => a.t - b.t); // oldest -> newest

    if (points.length < 2) return null;

    if (points.length > 120) {
      let stride = Math.ceil(points.length / 120);
      points = points.filter((_, index) => index % stride === 0);
    }
    return points.map(point => point.p);
  }
}
