import { AnyNetwork } from './networks/network';
import { AnyNetworkWallet } from './networks/base/networkwallets/networkwallet';
import { AnySubWallet } from './networks/base/subwallets/subwallet';

/** Logos composing the "All Chains" glyph (the four aggregate default chains). */
export const ALL_CHAINS_GLYPH_LOGOS = [
  'assets/wallet/networks/elastos.png',
  'assets/wallet/networks/elastos-esc.png',
  'assets/wallet/networks/ethereum.png',
  'assets/wallet/networks/pgp.png'
];

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

/**
 * One receivable chain on the multi-chain Receive page: a network, its side-instance
 * wallet, the main-token subwallet, and the chain's main receive address (derived
 * locally from the wallet keys - no network call, no active-network switch).
 */
export interface ReceiveTarget {
  network: AnyNetwork;
  networkWallet: AnyNetworkWallet;
  mainSubWallet: AnySubWallet;
  address: string;
}
