import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { GlobalSecurityService } from 'src/app/services/global.security.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';

type LockOption = {
  seconds: number;
  name: string;
};

/**
 * Lets the user choose how long the password database stays unlocked after they return to
 * the app / provide the master password. Lower values are more secure; 0 re-locks every time
 * the app is backgrounded.
 */
@Component({
  selector: 'app-autolock',
  templateUrl: './autolock.page.html',
  styleUrls: ['./autolock.page.scss'],
})
export class AutoLockPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

  public options: LockOption[] = [];
  public activeSeconds: number = null;

  constructor(
    public theme: GlobalThemeService,
    public translate: TranslateService,
    private security: GlobalSecurityService
  ) { }

  ngOnInit() {
    this.options = [
      { seconds: 0, name: this.translate.instant('settings.autolock-immediately') },
      { seconds: 60, name: this.translate.instant('settings.autolock-1min') },
      { seconds: 300, name: this.translate.instant('settings.autolock-5min') },
      { seconds: 900, name: this.translate.instant('settings.autolock-15min') },
      { seconds: 1800, name: this.translate.instant('settings.autolock-30min') },
      { seconds: 3600, name: this.translate.instant('settings.autolock-1hour') },
    ];
    this.activeSeconds = this.security.getLockTimeoutSeconds();
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('settings.autolock-title'));
  }

  public async select(option: LockOption) {
    const previous = this.activeSeconds;
    this.activeSeconds = option.seconds;
    try {
      await this.security.setLockTimeoutSeconds(option.seconds);
    } catch (e) {
      // Persisting failed: revert the highlighted choice so it reflects the stored value.
      this.activeSeconds = previous;
    }
  }
}
