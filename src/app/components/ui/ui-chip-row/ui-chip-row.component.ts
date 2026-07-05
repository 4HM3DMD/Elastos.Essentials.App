import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface UiChip {
  key: string;
  label: string;
  badge?: string;
}

/** A horizontally scrollable row of filter chips with one active chip. */
@Component({
  selector: 'ui-chip-row',
  templateUrl: './ui-chip-row.component.html',
  styleUrls: ['./ui-chip-row.component.scss']
})
export class UiChipRowComponent {
  @Input() public chips: UiChip[] = [];
  @Input() public active: string = null;

  @Output() public activeChange = new EventEmitter<string>();

  public trackByKey(_index: number, chip: UiChip): string {
    return chip.key;
  }

  public onSelect(chip: UiChip): void {
    if (chip.key !== this.active) this.activeChange.emit(chip.key);
  }
}
