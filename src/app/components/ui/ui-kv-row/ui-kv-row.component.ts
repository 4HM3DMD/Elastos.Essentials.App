import { Component, EventEmitter, Input, Output } from '@angular/core';

export type KvTone = 'default' | 'danger' | 'success';

/**
 * A label / value detail row (transaction and confirmation details). The value
 * can optionally be copied to the clipboard or opened in a block explorer; the
 * component only emits intent, the parent performs the side effect.
 */
@Component({
  selector: 'ui-kv-row',
  templateUrl: './ui-kv-row.component.html',
  styleUrls: ['./ui-kv-row.component.scss']
})
export class UiKvRowComponent {
  @Input() public label = '';
  @Input() public value = '';
  @Input() public copyValue: string = null;
  @Input() public explorerUrl: string = null;
  @Input() public tone: KvTone = 'default';
  @Input() public copyLabel = 'Copy';
  @Input() public explorerLabel = 'Open in explorer';

  @Output() public copy = new EventEmitter<string>();
  @Output() public openExplorer = new EventEmitter<string>();

  public onCopy(): void {
    if (this.copyValue) this.copy.emit(this.copyValue);
  }

  public onOpenExplorer(): void {
    if (this.explorerUrl) this.openExplorer.emit(this.explorerUrl);
  }
}
