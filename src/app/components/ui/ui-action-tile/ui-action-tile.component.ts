import { Component, EventEmitter, Input, Output } from '@angular/core';

/** A single tappable action: a tinted icon over a label, inside a rounded tile. */
@Component({
  selector: 'ui-action-tile',
  templateUrl: './ui-action-tile.component.html',
  styleUrls: ['./ui-action-tile.component.scss']
})
export class UiActionTileComponent {
  /** A local SVG path (inlined so it can be tinted with the accent color). */
  @Input() public icon: string = null;
  @Input() public label = '';
  @Input() public disabled = false;

  public isRemote(icon: string): boolean {
    return !!icon && icon.startsWith('http');
  }

  @Output() public pressed = new EventEmitter<void>();

  public onPressed(): void {
    if (!this.disabled) this.pressed.emit();
  }
}
