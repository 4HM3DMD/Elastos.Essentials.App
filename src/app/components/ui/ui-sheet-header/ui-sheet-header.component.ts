import { Component, Input } from '@angular/core';

export interface SheetOrigin {
  icon: string;
  name: string;
  verified?: boolean;
  domain?: string;
}

/**
 * The top of a bottom sheet: a drag grabber, an optional title, and an optional
 * "origin" row identifying the app/site a request is coming from.
 */
@Component({
  selector: 'ui-sheet-header',
  templateUrl: './ui-sheet-header.component.html',
  styleUrls: ['./ui-sheet-header.component.scss']
})
export class UiSheetHeaderComponent {
  @Input() public title: string = null;
  @Input() public origin: SheetOrigin = null;

  public isRemote(icon: string): boolean {
    return !!icon && icon.startsWith('http');
  }
}
