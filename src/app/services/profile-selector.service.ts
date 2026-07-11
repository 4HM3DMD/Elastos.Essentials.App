import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ProfileSelectorComponent } from '../components/profile-selector/profile-selector.component';

/** Ionic sheet presentation matching the network chooser (same grabber + breakpoints/animation). */
const PROFILE_SHEET_PRESENTATION = {
  breakpoints: [0, 0.72, 0.95],
  initialBreakpoint: 0.72,
  // The shared ui-sheet-header renders the grabber; Ionic's own handle would double it.
  handle: false,
  cssClass: 'profile-selector-sheet'
};

/**
 * Presents the profile (DID identity) selector sheet. Mirrors WalletNetworkUIService so
 * the profile selector opens with the same animation and style as the network chooser.
 */
@Injectable({ providedIn: 'root' })
export class ProfileSelectorService {
  private modal: HTMLIonModalElement = null;

  constructor(private modalCtrl: ModalController) {}

  /** Opens the profile selector sheet (no-op if one is already open). */
  public async open(): Promise<void> {
    if (this.modal) {
      return;
    }
    this.modal = await this.modalCtrl.create({
      component: ProfileSelectorComponent,
      ...PROFILE_SHEET_PRESENTATION
    });
    void this.modal.onWillDismiss().then(() => {
      this.modal = null;
    });
    await this.modal.present();
  }
}
