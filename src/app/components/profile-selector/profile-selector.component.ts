import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { IdentityService } from 'src/app/didsessions/services/identity.service';
import { UXService } from 'src/app/didsessions/services/ux.service';
import { App } from 'src/app/model/app.enum';
import { IdentityEntry } from 'src/app/model/didsessions/identityentry';
import { GlobalDIDSessionsService } from 'src/app/services/global.didsessions.service';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';

const DEFAULT_AVATAR = 'assets/launcher/default/default-avatar.svg';

/** One row of the profile selector: an identity plus the derived display fields. */
interface ProfileRow {
  entry: IdentityEntry;
  isCurrent: boolean;
  avatarUrl: string;
  didShort: string;
}

/**
 * Profile (DID identity) selector, presented as a bottom sheet matching the network
 * chooser. Lists every stored identity; the active one offers a gear -> its settings,
 * the others offer a remove control and switch on tap. Everything here REUSES existing
 * identity functions (switch / delete-with-warning / settings) - no new behavior.
 */
@Component({
  selector: 'app-profile-selector',
  templateUrl: './profile-selector.component.html',
  styleUrls: ['./profile-selector.component.scss']
})
export class ProfileSelectorComponent implements OnInit, OnDestroy {
  public profiles: ProfileRow[] = [];
  private removedSub: Subscription = null;

  constructor(
    public theme: GlobalThemeService,
    public translate: TranslateService,
    private modalCtrl: ModalController,
    private didSessions: GlobalDIDSessionsService,
    // Injected so the singletons are alive post-login: IdentityService performs the switch
    // and (via its 'deleteIdentity' listener) the removal; UXService owns the delete-warning
    // popover ('showDeleteIdentityPrompt' listener). A restored session may not have loaded
    // the didsessions module, so we instantiate them here rather than assume they exist.
    private identityService: IdentityService,
    private uxService: UXService,
    private events: GlobalEvents,
    private globalNav: GlobalNavService,
    private zone: NgZone
  ) {}

  ngOnInit() {
    this.buildProfiles();
    // The delete-with-warning flow emits 'identityremoved' after a profile is deleted;
    // rebuild the list so the removed row disappears while the sheet stays open.
    this.removedSub = this.events.subscribe('identityremoved', () => {
      this.zone.run(() => this.buildProfiles());
    });
  }

  ngOnDestroy() {
    if (this.removedSub) {
      this.removedSub.unsubscribe();
    }
  }

  private buildProfiles() {
    const current = this.didSessions.getSignedInIdentity();
    const currentDid = current ? current.didString : null;
    this.profiles = this.didSessions.getIdentityEntries().map(entry => ({
      entry,
      isCurrent: entry.didString === currentDid,
      avatarUrl: this.avatarUrl(entry),
      didShort: this.shortDid(entry.didString)
    }));
    // Active profile first.
    this.profiles.sort((a, b) => (a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1));
  }

  private avatarUrl(entry: IdentityEntry): string {
    if (entry.avatar && entry.avatar.base64ImageData) {
      return `data:${entry.avatar.contentType};base64,${entry.avatar.base64ImageData}`;
    }
    return DEFAULT_AVATAR;
  }

  private shortDid(did: string): string {
    if (!did) {
      return '';
    }
    return did.length > 22 ? `${did.slice(0, 16)}...${did.slice(-6)}` : did;
  }

  public trackByDid(_index: number, row: ProfileRow): string {
    return row.entry.didString;
  }

  /** Row tap: the active profile opens its settings; any other profile is switched to. */
  public onSelect(row: ProfileRow) {
    if (row.isCurrent) {
      this.goToSettings();
      return;
    }
    // Switching is a full re-sign-in as that identity (existing behavior); it may prompt
    // the master password if the store is locked, then reloads the app as that profile.
    void this.modalCtrl.dismiss();
    void this.identityService.signIn(row.entry, true);
  }

  /** Gear on the active profile -> its profile/settings management. */
  public onSettings(event: Event) {
    event.stopPropagation();
    this.goToSettings();
  }

  private goToSettings() {
    void this.modalCtrl.dismiss();
    void this.globalNav.navigateTo(App.IDENTITY, '/identity/myprofile/home');
  }

  /** Remove control on another profile -> the existing delete-with-warning flow. */
  public onRemove(row: ProfileRow, event: Event) {
    event.stopPropagation();
    this.events.publish('showDeleteIdentityPrompt', row.entry);
  }
}
