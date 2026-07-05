# Task: WO-6 Shared UI primitives

**Task ID**: UI-6
**Created**: 2026-07-05
**Status**: Review (implemented, reviewed, all fixes applied, verified, pushed 2026-07-05; commit 082a519fe)
**Priority**: High
**Branch**: ui/p6-ui-primitives (stacked on ui/p5-remove-lightweight, fork 4HM3DMD)
**Spec**: doc 144 Part II.6 + WO-6. First Phase-3 item. Local-only file.

## Description
Build the shared UI primitive library at src/app/components/ui/ (UiComponentsModule)
per doc 144 II.6: 9 presentational components, token-driven (zero hex), input-driven
(no internal i18n), with default/pressed/disabled/skeleton states + aria-labels. Plus a
developer-only demo harness page listing every component in every state over a stress
dataset. No consumer changes yet — components are built unused; Phase 4 screens adopt them.

## Components (9, in 7 II.6 groups)
1. ui-token-row — icon-circle(38px)+badge + title/sub + value/subValue(up/down/muted) + skeleton; (pressed)
2. ui-amount-display — value/unit/fiat, size 1|2|3, hidden mask, JS font auto-shrink (2px/tier→floor 14px→middle-ellipsis); (toggleHidden)
3. ui-action-tile + ui-action-grid([columns]=3|4) — tinted icon over label, disabled; (pressed)
4. ui-chip-row — horizontal-scroll filter chips, active=accent bg+ink; trackBy; (activeChange)
5. ui-sheet-header — grabber + optional title + optional origin row (icon/name/verified/domain)
6. ui-kv-row — label/value, copyValue?, explorerUrl?, tone default|danger|success; emits (copy)/(openExplorer)
7. ui-empty-state — icon/message/actionLabel?; (action). ui-skeleton — rows/kind row|card|block, reduced-motion aware

## Conventions followed (recon-verified)
- Classic NgModule (no standalone — Angular 13.1); mirrors sharedcomponents.module.ts;
  imports CommonModule/IonicModule/TranslateModule/InlineSVGModule (ng-inline-svg-2).
- inlineSVG for local SVG icons (tintable via color), <img> for remote/http.
- ebutton.component was the style template (:host wrapper, var()-only, ion-ripple-effect,
  ion-activatable, transition all 0.2s ease). Literal px radius (14/10/20) — no radius vars exist.
- NO ChangeDetectionStrategy.OnPush (not the codebase pattern for leaf components); trackBy
  on the chip + skeleton *ngFor.
- Skeleton = ion-skeleton-text animated (opacity pulse, no gradients) + prefers-reduced-motion guard.
- Tokens used: --ion-text-color, --ion-background-color, --essentials-{box-color, accent,
  accent-ink, text-secondary, text-tertiary, success, danger, border-separator-color,
  button-background-color, button-text-color}. ZERO hex (acceptance grep passes).

## Demo harness
src/app/developertools/pages/ui-components-demo/ (page behind Developer Mode). Wired into
developertools routing.ts + module.ts (declaration + UiComponentsModule import +
entryComponents); dev home gets a "UI Components" ebutton launcher. Shows each component
across states incl. stress rows (very long token name, huge amount, empty fields, skeletons).
(Demo page is removed by WO-22 per plan — named acceptance there.)

## Implementation plan
- [x] UiComponentsModule + 9 components (ts/html/scss each)
- [x] Demo harness page + developertools wiring + dev-home launcher
- [x] Zero-hex acceptance grep passes
- [x] AOT build clean (templates validated — no unknown-element/bind errors)
- [x] Full iOS + Android builds green
- [x] Demo verified on Android (dark): all 9 components render; hide-toggle masks value+fiat; auto-shrink fits huge values; disabled tile dimmed; skeleton shimmer. iOS boots clean.
- [x] Review fleet (11 agents, 8 findings, 0 refuted, ALL FIXED): middle-ellipsis now truly implemented in JS (was doc/behavior mismatch); setTimeout leak fixed (OnDestroy + clear + runOutsideAngular); toggleHidden now has a built-in eye control (showToggle input); action-tile icon guarded + remote support; token-row interactivity gated (click/activatable/aria only when a (pressed) observer exists); kv-row/sheet-header aria-labels overridable/decorative; unused TranslateModule dropped.
- [x] Commit, push fork (commit 082a519fe)

## Acceptance criteria
Doc 144 WO-6: demo screenshots (black variants + SE-class viewport); components consume vars
only (zero hex in ui/); lint; no consumer changes yet. Est +~30 files.
