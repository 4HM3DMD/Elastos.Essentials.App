import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { App } from 'src/app/model/app.enum';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalSecurityService } from 'src/app/services/global.security.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { SettingsService } from '../../services/settings.service';

/**
 * Consolidated "App Lock" security screen: change the master password, configure auto-lock,
 * and toggle screenshot protection - all the password/lock controls in one place instead of
 * scattered rows in the settings menu.
 */
@Component({
  selector: 'app-applock',
  templateUrl: './applock.page.html',
  styleUrls: ['./applock.page.scss'],
})
export class AppLockPage implements OnInit {
  @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

  public blockScreenshots = false;

  // Maps the stored auto-lock timeout (seconds) to a label for the row subtitle.
  private readonly lockLabelKeys: { [seconds: number]: string } = {
    0: 'settings.autolock-immediately',
    60: 'settings.autolock-1min',
    300: 'settings.autolock-5min',
    900: 'settings.autolock-15min',
    1800: 'settings.autolock-30min',
    3600: 'settings.autolock-1hour',
  };

  constructor(
    public theme: GlobalThemeService,
    public translate: TranslateService,
    private settingsService: SettingsService,
    private security: GlobalSecurityService,
    private nav: GlobalNavService
  ) { }

  async ngOnInit() {
    // "Screen capture allowed" is the inverse of "block screenshots".
    this.blockScreenshots = !(await this.security.getScreenCaptureAllowed());
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('settings.applock-title'));
  }

  /** Current auto-lock timeout, formatted for the row subtitle. */
  public autoLockLabel(): string {
    const key = this.lockLabelKeys[this.security.getLockTimeoutSeconds()] || 'settings.autolock-5min';
    return this.translate.instant(key);
  }

  public onChangePassword() {
    void this.settingsService.changePassword();
  }

  public onAutoLock() {
    void this.nav.navigateTo(App.SETTINGS, '/settings/autolock');
  }

  public async toggleBlockScreenshots() {
    // ngModel has already flipped blockScreenshots to the new value.
    await this.security.setScreenCaptureAllowed(!this.blockScreenshots);
  }
}
