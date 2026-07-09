import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { UiActionGridComponent } from './ui-action-tile/ui-action-grid.component';
import { UiActionTileComponent } from './ui-action-tile/ui-action-tile.component';
import { UiAmountDisplayComponent } from './ui-amount-display/ui-amount-display.component';
import { UiChipRowComponent } from './ui-chip-row/ui-chip-row.component';
import { UiEmptyStateComponent } from './ui-empty-state/ui-empty-state.component';
import { UiKvRowComponent } from './ui-kv-row/ui-kv-row.component';
import { UiOriginHeaderComponent } from './ui-origin-header/ui-origin-header.component';
import { UiSheetHeaderComponent } from './ui-sheet-header/ui-sheet-header.component';
import { UiSkeletonComponent } from './ui-skeleton/ui-skeleton.component';
import { UiSparklineComponent } from './ui-sparkline/ui-sparkline.component';
import { UiTokenRowComponent } from './ui-token-row/ui-token-row.component';

/**
 * Shared, presentational UI primitives (doc 144 II.6). Every component here is
 * theme-token driven (no hardcoded colors), input-driven (no internal i18n), and
 * has default / pressed / disabled / skeleton states where applicable. Feature
 * modules import UiComponentsModule to use them.
 */
@NgModule({
  declarations: [
    UiTokenRowComponent,
    UiAmountDisplayComponent,
    UiActionTileComponent,
    UiActionGridComponent,
    UiChipRowComponent,
    UiSheetHeaderComponent,
    UiOriginHeaderComponent,
    UiKvRowComponent,
    UiEmptyStateComponent,
    UiSkeletonComponent,
    UiSparklineComponent
  ],
  imports: [CommonModule, IonicModule, InlineSVGModule],
  exports: [
    UiTokenRowComponent,
    UiAmountDisplayComponent,
    UiActionTileComponent,
    UiActionGridComponent,
    UiChipRowComponent,
    UiSheetHeaderComponent,
    UiOriginHeaderComponent,
    UiKvRowComponent,
    UiEmptyStateComponent,
    UiSkeletonComponent,
    UiSparklineComponent
  ]
})
export class UiComponentsModule {}
