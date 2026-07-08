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
  /** Middle-truncate the value (for long hashes/addresses) so it stays on one line. */
  @Input() public ellipsisMiddle = false;
  /** When false, the row draws no bottom hairline (rows separated by whitespace only). */
  @Input() public divider = true;

  @Output() public copy = new EventEmitter<string>();
  @Output() public openExplorer = new EventEmitter<string>();

  public onCopy(): void {
    if (this.copyValue) this.copy.emit(this.copyValue);
  }

  public onOpenExplorer(): void {
    if (this.explorerUrl) this.openExplorer.emit(this.explorerUrl);
  }

  /** Leading part of a middle-truncated value (everything but the last 6 chars). */
  public get valueHead(): string {
    const v = this.value == null ? '' : String(this.value);
    if (!this.ellipsisMiddle || v.length <= 13) return v;
    return v.slice(0, v.length - 6);
  }

  /** Trailing part kept intact so the value's end (e.g. a hash suffix) stays visible. */
  public get valueTail(): string {
    const v = this.value == null ? '' : String(this.value);
    if (!this.ellipsisMiddle || v.length <= 13) return '';
    return v.slice(-6);
  }
}
