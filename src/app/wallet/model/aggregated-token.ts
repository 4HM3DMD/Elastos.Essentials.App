import { AnyNetwork } from './networks/network';
import { AnySubWallet } from './networks/base/subwallets/subwallet';

/**
 * One row of the all-chains aggregate token list: a subwallet plus the network
 * it lives on. Balance and fiat values are read live from the subwallet (they
 * come from the on-device balance cache until a refresh lands).
 */
export interface AggregatedTokenRow {
  subWallet: AnySubWallet;
  network: AnyNetwork;
  /** One of the four always-visible ELA instruments (main chain, ESC, Ethereum, PGP). */
  isDefaultEla: boolean;
  /** False until the subwallet has ever known a balance (cache or fresh fetch): the value cell shows a quiet skeleton. */
  hasValue: boolean;
}
