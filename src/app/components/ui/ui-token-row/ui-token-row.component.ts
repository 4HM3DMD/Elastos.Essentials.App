import { Component, EventEmitter, Input, Output } from '@angular/core';

export type SubValueTone = 'up' | 'down' | 'muted';

/**
 * A single token / network / activity row: an icon circle (with an optional
 * network badge) on the left, a title + optional subtitle, and an optional
 * value + sub-value on the right. Renders a skeleton placeholder when loading.
 */
@Component({
  selector: 'ui-token-row',
  templateUrl: './ui-token-row.component.html',
  styleUrls: ['./ui-token-row.component.scss']
})
export class UiTokenRowComponent {
  /** Icon path: an inlined local SVG, or a remote/PNG url rendered as an img. */
  @Input() public icon: string = null;
  /** Optional small network badge overlaid on the bottom-right of the icon. */
  @Input() public badge: string = null;
  @Input() public title = '';
  @Input() public sub: string = null;
  @Input() public value: string = null;
  @Input() public subValue: string = null;
  @Input() public subValueTone: SubValueTone = 'muted';
  @Input() public skeleton = false;
  /** Renders a right chevron (for navigation rows with no value column). */
  @Input() public chevron = false;

  @Output() public pressed = new EventEmitter<void>();

  /** A row is interactive only when a parent subscribes to (pressed). */
  public get interactive(): boolean {
    return this.pressed.observers.length > 0;
  }

  /** Remote images are cached as <img>; local SVGs are inlined so they can be tinted. */
  public isRemote(icon: string): boolean {
    return !!icon && icon.startsWith('http');
  }

  public onPressed(): void {
    if (!this.skeleton) this.pressed.emit();
  }
}
