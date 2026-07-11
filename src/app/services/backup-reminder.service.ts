import { Injectable } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BackupReminderComponent } from '../components/backup-reminder/backup-reminder.component';
import { GlobalDIDSessionsService } from './global.didsessions.service';
import { GlobalStorageService } from './global.storage.service';
import { DIDSessionsStore } from './stores/didsessions.store';

const STORAGE_CONTEXT = 'backup-reminder';
const STORAGE_KEY = 'receive-reminder-shown';

/** What the caller should do next after the reminder gate. */
export type BackupReminderOutcome = 'proceed' | 'backup';

/**
 * Shows the "identity not backed up" reminder ONCE per identity before Receive, for
 * app-created wallets whose identity was never backed up. Encapsulates the once-only
 * persistence and the on-brand reminder popover so both home screens share one path.
 */
@Injectable({ providedIn: 'root' })
export class BackupReminderService {
  private popover: HTMLIonPopoverElement = null;

  constructor(
    private popoverCtrl: PopoverController,
    private translate: TranslateService,
    private storage: GlobalStorageService
  ) {}

  /**
   * Returns 'backup' if the user chose to back up now; otherwise 'proceed' (already
   * backed up, already reminded once, or the user skipped). The reminder is shown at
   * most once per identity.
   */
  public async gate(): Promise<BackupReminderOutcome> {
    const backedUp = await GlobalDIDSessionsService.instance.activeIdentityWasBackedUp();
    if (backedUp) {
      return 'proceed';
    }

    const did = DIDSessionsStore.signedInDIDString;
    const alreadyShown = await this.storage.getSetting<boolean>(did, null, STORAGE_CONTEXT, STORAGE_KEY, false);
    if (alreadyShown) {
      return 'proceed';
    }

    // Persist "shown" up front so the reminder is genuinely once-only even if the user
    // backgrounds the app or navigates away while it is open.
    await this.storage.setSetting<boolean>(did, null, STORAGE_CONTEXT, STORAGE_KEY, true);

    const action = await this.present();
    return action === 'backup' ? 'backup' : 'proceed';
  }

  private present(): Promise<'backup' | 'skip'> {
    return new Promise(resolve => {
      void this.popoverCtrl.create({
        mode: 'ios',
        cssClass: 'backup-reminder-popover',
        component: BackupReminderComponent,
        componentProps: {
          title: this.translate.instant('launcher.backup-title'),
          message: this.translate.instant('launcher.backup-message')
        },
        backdropDismiss: false,
        translucent: false
      }).then(popover => {
        this.popover = popover;
        void popover.onWillDismiss().then(params => {
          this.popover = null;
          const action = params && params.data && params.data.action;
          resolve(action === 'backup' ? 'backup' : 'skip');
        });
        void popover.present();
      }).catch(() => {
        // The popover could not be created: fail open (proceed to Receive) rather than
        // leaving the caller's await hanging forever.
        resolve('skip');
      });
    });
  }
}
