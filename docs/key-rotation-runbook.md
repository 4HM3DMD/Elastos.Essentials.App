# API Key Rotation Runbook

Third-party API keys are no longer hardcoded in source. They are read from `environment/.env`
(local) or CI secrets (release) by `environment/set_env.ts`, which writes them into the
gitignored `src/environments/environment.ts` / `environment.prod.ts` at build time.

**Important:** externalizing the keys removed them from the current source tree, but the
previously-committed values remain in git history and are therefore still live and abusable
until they are **rotated**. Rotation is the actual containment step; the code change alone
provides none. Rotate the keys below, then this document's value table can seed a secret
scanner's historical allowlist.

## Keys and where they come from

| Env var | Provider | Used by | Empty-value behavior |
| --- | --- | --- | --- |
| `TRONGRID_API_KEYS` | TronGrid | `global.tron.service.ts` (random pick per request) | Anonymous / rate-limited Tron calls |
| `ETHERSCAN_SHARED_API_KEY` | Etherscan V2 | celo, arbitrum, polygon, avalanche C, gnosis, bttc tx providers | Rate-limited EVM history |
| `ETHERSCAN_ETH_API_KEY` | Etherscan V2 | ethereum tx provider | Rate-limited EVM history |
| `ETHERSCAN_BSC_API_KEY` | Etherscan V2 | bsc tx provider | Rate-limited EVM history |
| `ETHERSCAN_FTM_API_KEY` | Etherscan V2 | fantom tx provider | Rate-limited EVM history |
| `ETHERSCAN_CRO_API_KEY` | Etherscan V2 | cronos tx provider | Rate-limited EVM history |
| `COVALENT_API_KEY` | Covalent | `covalent.helper.ts` | Degraded balances / tx augmentation |
| `ASSIST_API_KEY` | Assist | `global.publication.service.ts` | DID 2.0 publication fails |
| `NOWNODES_API_KEY` | Nownodes | `global.btc.service.ts` (pre-existing) | No BTC chain data |

## Rotation procedure (per key)

1. Mint a replacement key in the provider dashboard (TronGrid, Etherscan account, Covalent,
   Assist, Nownodes, WalletConnect Cloud).
2. Set the new value:
   - Local/dev: `environment/.env`.
   - Release/CI: the corresponding GitHub Actions secret, mapped to the env var in the build
     workflow before `npm run build-env`.
3. Ship a release built with the new key.
4. Revoke the old key **one full release cycle later**, so any in-flight clients using the old
   value are not broken.
5. Repeat quarterly (D3 cadence) or immediately on any suspected exposure.

## Open owner decisions

- **OD-1 (Etherscan consolidation):** the five distinct Etherscan-family keys can be collapsed
  into a single Etherscan V2 multi-chain account. If done, this is a one-line change in
  `set_env.ts` (`etherscan.*` all read the same var); the source files do not change.
- **WalletConnect projectId** (`src/app/config/globalconfig.ts`) is a *public* client identifier,
  not a secret, and was intentionally left in source so WalletConnect does not break on
  un-injected builds. Rotate it via WalletConnect Cloud only if abuse is observed.
- **Dead commented Infura key** at
  `src/app/wallet/model/address-resolvers/resolvers/UnstoppableDomainsAddressResolver.ts:71`
  is unreachable but sits in history; revoke it during the next rotation and delete the comment.

## CI (owner-gated)

Injecting real secret **values** into GitHub Actions secrets is an owner action. The workflow
YAML that maps `${{ secrets.* }}` to the `TRONGRID_/ETHERSCAN_/COVALENT_/ASSIST_/NOWNODES_`
env vars for `npm run build-env` should land on the fork first; any change to a canonical
`elastos/*` workflow needs explicit owner approval.
