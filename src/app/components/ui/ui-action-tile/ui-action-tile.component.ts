import { Component, EventEmitter, Input, Output } from '@angular/core';

/** A single tappable action: a tinted icon over a label, inside a rounded tile. */
@Component({
  selector: 'ui-action-tile',
  templateUrl: './ui-action-tile.component.html',
  styleUrls: ['./ui-action-tile.component.scss']
})
export class UiActionTileComponent {
  /** An icon path: a local .svg (inlined + tinted) or a local raster / remote url rendered as an <img>. */
  @Input() public icon: string = null;
  @Input() public label = '';
  @Input() public disabled = false;

  public isRemote(icon: string): boolean {
    return !!icon && icon.startsWith('http');
  }

  /**
   * Only local .svg files are inlined (so they can be tinted). Everything else — remote urls and
   * local raster icons like .png/.jpg (the premium 3D action glyphs) — must render as an <img>,
   * or inlineSVG fails silently and nothing shows.
   */
  public isInlineSvg(icon: string): boolean {
    return !!icon && !this.isRemote(icon) && icon.toLowerCase().split('?')[0].endsWith('.svg');
  }

  @Output() public pressed = new EventEmitter<void>();

  public onPressed(): void {
    if (!this.disabled) this.pressed.emit();
  }
}
