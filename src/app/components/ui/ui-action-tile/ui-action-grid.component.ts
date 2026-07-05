import { Component, HostBinding, Input } from '@angular/core';

/** Lays out its projected <ui-action-tile> children in a fixed-column grid. */
@Component({
  selector: 'ui-action-grid',
  template: '<ng-content></ng-content>',
  styleUrls: ['./ui-action-grid.component.scss']
})
export class UiActionGridComponent {
  @Input() public columns: 3 | 4 = 4;

  @HostBinding('style.--ui-action-columns')
  public get columnsVar(): string {
    return `${this.columns}`;
  }
}
