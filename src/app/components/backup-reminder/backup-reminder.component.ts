import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { NavParams, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';

/** Seconds the "Skip" action stays locked so a first-time user actually reads the reminder. */
const SKIP_LOCK_SECONDS = 5;

/** Action returned to the caller on dismiss. */
export type BackupReminderAction = 'backup' | 'skip';

/**
 * On-brand, once-only "identity not backed up" reminder shown before Receive for new
 * users. "Back Up Now" is available immediately; "Skip" is locked behind a short
 * countdown so the reminder is read rather than dismissed reflexively.
 */
@Component({
  selector: 'app-backup-reminder',
  templateUrl: './backup-reminder.component.html',
  styleUrls: ['./backup-reminder.component.scss']
})
export class BackupReminderComponent implements OnInit, OnDestroy {
  public title = '';
  public message = '';
  public secondsLeft = SKIP_LOCK_SECONDS;
  private timer: ReturnType<typeof setInterval> = null;

  constructor(
    public theme: GlobalThemeService,
    public translate: TranslateService,
    private navParams: NavParams,
    private popoverCtrl: PopoverController,
    private zone: NgZone
  ) {}

  ngOnInit() {
    this.title = this.navParams.get('title') || '';
    this.message = this.navParams.get('message') || '';
    this.startCountdown();
  }

  ngOnDestroy() {
    this.clearTimer();
  }

  private startCountdown() {
    this.timer = setInterval(() => {
      this.zone.run(() => {
        if (this.secondsLeft > 0) {
          this.secondsLeft--;
        }
        if (this.secondsLeft <= 0) {
          this.clearTimer();
        }
      });
    }, 1000);
  }

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public get skipLocked(): boolean {
    return this.secondsLeft > 0;
  }

  public onSkip() {
    if (this.skipLocked) {
      return;
    }
    void this.popoverCtrl.dismiss({ action: 'skip' as BackupReminderAction });
  }

  public onBackup() {
    void this.popoverCtrl.dismiss({ action: 'backup' as BackupReminderAction });
  }
}
