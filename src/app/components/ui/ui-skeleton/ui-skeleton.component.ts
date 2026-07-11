import { Component, Input } from '@angular/core';

export type SkeletonKind = 'row' | 'card' | 'block' | 'hero' | 'tile' | 'kv';

/**
 * A repeated loading placeholder shaped like the content about to arrive:
 * - row:   list row - icon disc + two text lines (+ optional right value bars).
 *          [disc] sets the disc diameter (34 = ui-token-row's 2026 disc; 40/50
 *          for voting/contacts avatars; 0 hides the disc for disc-less rows).
 * - kv:    detail row - label bar left, value bar right (ui-kv-row shape).
 * - hero:  balance hero - one large amount bar + a small sub line.
 * - tile:  action-tile grid - N rounded 84px tiles in a 4-column grid.
 * - card:  full-width 96px rounded blocks.
 * - block: thin 20px bars.
 */
@Component({
  selector: 'ui-skeleton',
  templateUrl: './ui-skeleton.component.html',
  styleUrls: ['./ui-skeleton.component.scss']
})
export class UiSkeletonComponent {
  @Input() public rows = 3;
  @Input() public kind: SkeletonKind = 'row';
  /** Row disc diameter in px; 0 hides the disc (rows without an icon). */
  @Input() public disc = 34;
  /** Rows only: show right-aligned value bars (rows with a trailing amount). */
  @Input() public value = false;

  public get items(): number[] {
    const count = Math.max(0, Math.floor(this.rows));
    return Array.from({ length: count }, (_v, i) => i);
  }

  public trackByIndex(index: number): number {
    return index;
  }
}
