import { Component, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { IdentityService } from 'src/app/didsessions/services/identity.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';

/**
 * Add Profile: the on-brand entry point for adding a second identity (DID) from inside
 * the wallet. Offers the two paths - create a brand-new identity, or import an existing
 * one from its paper key - and hands off to the shared didsessions create/import flows.
 * Replaces the legacy "Welcome to Web3" didsessions welcome for the add-profile path.
 */
@Component({
  selector: 'app-add-profile',
  templateUrl: './add-profile.page.html',
  styleUrls: ['./add-profile.page.scss']
})
export class AddProfilePage {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  // Guards against double-launching a flow while its navigation is starting.
  private launching = false;

  constructor(
    public theme: GlobalThemeService,
    private translate: TranslateService,
    private identityService: IdentityService
  ) {}

  ionViewWillEnter() {
    // Reset on every entry so returning here (after cancelling a flow) re-enables the choices.
    this.launching = false;
    this.titleBar.setTitle(this.translate.instant('launcher.add-profile-title'));
  }

  private launch(action: () => void): void {
    if (this.launching) {
      return;
    }
    this.launching = true;
    action();
  }

  public onCreate(): void {
    this.launch(() => this.identityService.startCreatingNewDIDWithNewMnemonic());
  }

  public onImport(): void {
    this.launch(() => { void this.identityService.startImportingMnemonic(); });
  }
}
