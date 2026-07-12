import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';

/**
 * The identity-preparation progress view. Shows one step card at a time, driven by
 * slideIndex from the preparation service (publish -> sign-in -> storage -> wallet ->
 * done), with a "please wait" loader beneath. The previous ion-slides carousel is gone:
 * slideIndex is service-driven, not swiped, and the Swiper never initialized, so it just
 * rendered an empty broken card.
 */
@Component({
  selector: 'app-prepare-did-advanced-mode',
  templateUrl: './advanced-mode.component.html',
  styleUrls: ['./advanced-mode.component.scss']
})
export class AdvancedModeComponent {
  @Input() hidden = true;
  @Input() slideIndex = 0;

  @Input() publishError: string = null;
  @Input() signInError: string = null;
  @Input() hiveError: string = null;
  @Input() walletError: string = null;
  @Input() finalizingPreparation = false;

  @Output() slideIndexChange = new EventEmitter<number>();
  @Output() cancelPreparation = new EventEmitter<void>();
  @Output() finalizePreparation = new EventEmitter<void>();

  constructor(public theme: GlobalThemeService) {}

  onCancelPreparation() {
    this.cancelPreparation.emit();
  }

  onFinalizePreparation() {
    this.finalizePreparation.emit();
  }
}
