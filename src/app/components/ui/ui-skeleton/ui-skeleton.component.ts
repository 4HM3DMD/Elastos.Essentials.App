import { Component, Input } from '@angular/core';

export type SkeletonKind = 'row' | 'card' | 'block';

/** A repeated loading placeholder: N rows/cards/blocks of shimmering skeletons. */
@Component({
  selector: 'ui-skeleton',
  templateUrl: './ui-skeleton.component.html',
  styleUrls: ['./ui-skeleton.component.scss']
})
export class UiSkeletonComponent {
  @Input() public rows = 3;
  @Input() public kind: SkeletonKind = 'row';

  public get items(): number[] {
    const count = Math.max(0, Math.floor(this.rows));
    return Array.from({ length: count }, (_v, i) => i);
  }

  public trackByIndex(index: number): number {
    return index;
  }
}
