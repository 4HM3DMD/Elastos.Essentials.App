# Task: WO-25-lite Browser home as tab landing

**Task ID**: UI-25L
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, fix applied, verified both platforms, pushed 2026-07-05)
**Priority**: Low
**Branch**: ui/p13-browser-landing (stacked on ui/p12-proposals-combined, fork 4HM3DMD)
**Spec**: Tab Shell v2 plan; full WO-25 (doc 144) remains. Local-only file.

## What changed
- dappbrowser/pages/home/home.scss only: padding-bottom 15% →
  calc(24px + env(safe-area-inset-bottom)) (tab clearance comes from the global
  body.has-tabbar rule; the calc covers the ui.tabbar kill-switch case — review
  finding 7 fix); dapp-row radius 17px → 14px (shared token). No behavior changes.

## Verification
iOS: launchpad + policy notice above the bar. Android: suggested dApps list bottom
row fully reachable above the bar.
