# Task: WO-3b Remove Mainchain Polls module

**Task ID**: UI-3b
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed clean, verified, pushed 2026-07-05; commit 9fb58a162)
**Priority**: Medium
**Branch**: ui/p9-remove-mainchainpolls (stacked on ui/p8-wallet-home, fork 4HM3DMD)
**Spec**: doc 144 D19 (Ahmed 2026-07-05: "Polls get removed entirely"). Local-only file.

## What changed
- Deleted src/app/voting/mainchainpolls/** and translations/strings/mainchainpolls/**.
- Edited: app-routing.module.ts (route removed), app.enum.ts (MAINCHAIN_POLLS removed,
  verified no string-tag usages), elastos-voting.widget.ts (import + DI + polls apps.push
  block removed — widget keeps only the BPoS row), generate_translations.ts,
  launcher app-mainchain-polls* keys ×4 languages (it.ts CRLF-preserved).

## Verification
AOT + both platform builds green; widget shows only BPoS; Python residual scan for
mainchainpolls|MAINCHAIN_POLLS clean; review workflow returned 0 findings (1 refuted).
