# Dependency overrides and security pins

Every entry in the `overrides` block of `package.json` (and any direct pin made
for a CVE) is documented here with its reason, CVE, date added, and the
condition under which it can be removed. Ref: security plan doc 147 item A1.

`package-lock.json` is gitignored in this repo, so these `overrides` are the
authoritative pinning mechanism; each `npm install` applies them.

## Active overrides

| Package (scope) | Forced version | CVE(s) fixed | Added | Removal condition |
|---|---|---|---|---|
| `libsodium-wrappers` (global) | `0.7.10` | (pre-existing pin) | before 2026 | Original reason not recorded; re-verify before removing. |
| `elliptic` (global, via `$elliptic`) | matches the direct dep `^6.6.1` (resolves 6.6.1) | CVE-2024-42459, CVE-2024-42460, CVE-2024-42461, CVE-2024-48948, CVE-2024-48949 | 2026-07-09 | When `@elastosfoundation/did-js-sdk` and `js-crypto-key-utils` ship elliptic 6.6.1+ (plan C4). The `$elliptic` form is required because elliptic is also a direct dependency. |
| `ethereum-cryptography > secp256k1` (scoped) | `4.0.4` | CVE-2024-48930 (GHSA-584q-6j8j-r5pm) | 2026-07-09 | When the web3/ethers stack no longer pulls `ethereum-cryptography` on 4.0.3 (plan C2/C4). |
| `@kava-labs/sig > secp256k1` (scoped) | `3.8.1` | CVE-2024-48930 | 2026-07-09 | When the Kava network/SDK is upgraded or dropped (plan OD-3 / A4). Scoped because 3.x, 4.x and 5.x of secp256k1 have incompatible APIs; a global override would break the 3.x/4.x consumers. |

## Direct dependency bump (not an override)

| Package | From -> To | CVE(s) fixed | Added |
|---|---|---|---|
| `secp256k1` (direct) | `5.0.0` -> `5.0.1` | CVE-2024-48930 | 2026-07-09 |

## Known-unfixed / deferred

- **`ws@3.3.3` under `eth-lib`** (CVE-2021-32640 ReDoS, CVE-2024-37890 DoS). An
  `eth-lib > ws` override to 7.5.11 was attempted but npm does not cleanly lift
  the nested copy (two `eth-lib` versions, 0.1.29 and 0.2.8, are present and the
  nested override resolves back to 3.3.3). This copy is DORMANT: it is reachable
  only through web3's `WebsocketProvider`, and Essentials constructs no websocket
  provider (verified: the only `wss://` in `src/` is WalletConnect v2's relay,
  which uses `@walletconnect/sign-client`'s own ws@8.x, not eth-lib's). It is
  eliminated entirely by the Phase C web3 removal (plan C2), which is its
  permanent fix.

## Not yet applied (see plan A1)

- **axios** transitive copies (0.21.4 / 0.24.0 / 0.27.2, under ts-retrofit,
  @cosmjs/tendermint-rpc, @elastosfoundation/did-js-sdk, and the nested hive SDK
  under @feedsnetwork/feeds-js-sdk) for CVE-2023-45857 and CVE-2025-27152. The
  overrides require scoping across four parents (one deeply nested) and the fix
  cannot be device-verified headless (it touches the Hive vault, Cosmos/Kava
  balance, and DID operation flows), so it is held for a device-smoke pass.
