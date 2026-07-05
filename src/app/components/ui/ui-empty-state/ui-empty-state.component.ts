import { Component, EventEmitter, Input, Output } from '@angular/core';

/** An empty-list placeholder: an icon, a message, and an optional action button. */
@Component({
  selector: 'ui-empty-state',
  templateUrl: './ui-empty-state.component.html',
  styleUrls: ['./ui-empty-state.component.scss']
})
export class UiEmptyStateComponent {
  @Input() public icon: string = null;
  @Input() public message = '';
  @Input() public actionLabel: string = null;

  @Output() public action = new EventEmitter<void>();

  public isRemote(icon: string): boolean {
    return !!icon && icon.startsWith('http');
  }

  public onAction(): void {
    this.action.emit();
  }
}
