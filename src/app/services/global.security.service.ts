import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Logger } from '../logger';
import { IdentityEntry } from "../model/didsessions/identityentry";
import { GlobalPasswordService } from './global.password.service';
import { GlobalPreferencesService } from './global.preferences.service';
import { GlobalService, GlobalServiceManager } from './global.service.manager';
import { GlobalStorageService } from './global.storage.service';
import { DIDSessionsStore } from './stores/didsessions.store';
import { NetworkTemplateStore } from './stores/networktemplate.store';

declare let internalManager: InternalPlugin.InternalManager;

// Default auto-lock delay (seconds) used before a signed-in preference is loaded.
const DEFAULT_LOCK_TIMEOUT_SECONDS = 300;


@Injectable({
  providedIn: 'root'
})
export class GlobalSecurityService implements GlobalService {
  public static instance: GlobalSecurityService;  // Convenient way to get this service from non-injected classes

  // Cached auto-lock delay (seconds) for the signed-in user, so the lifecycle handlers can
  // read it synchronously. 0 means "lock every time the app is backgrounded".
  private lockTimeoutSeconds = DEFAULT_LOCK_TIMEOUT_SECONDS;
  // Timestamp (ms) when the app was last backgrounded, or null while in the foreground.
  private backgroundedAt: number = null;

  constructor(
    private storage: GlobalStorageService,
    private prefs: GlobalPreferencesService,
    private platform: Platform,
    private passwordService: GlobalPasswordService
  ) {
    GlobalSecurityService.instance = this;
    GlobalServiceManager.getInstance().registerService(this);

    // Auto-lock: re-lock the password database once the app has been in the background for
    // at least the configured timeout, so returning to it re-prompts for the master password.
    this.platform.pause.subscribe(() => {
      this.backgroundedAt = Date.now();
      // "Lock immediately" mode: don't wait for the return, lock as soon as we leave.
      if (this.lockTimeoutSeconds === 0) {
        this.lockPasswordDatabase();
      }
    });
    this.platform.resume.subscribe(() => {
      if (this.backgroundedAt === null) {
        return;
      }
      const backgroundedMs = Date.now() - this.backgroundedAt;
      this.backgroundedAt = null;
      if (this.lockTimeoutSeconds === 0 || backgroundedMs >= this.lockTimeoutSeconds * 1000) {
        this.lockPasswordDatabase();
      }
    });
  }

  async onUserSignIn(signedInIdentity: IdentityEntry): Promise<void> {
    await this.restoreScreenCapture();
    await this.refreshLockTimeoutCache(signedInIdentity.didString);
  }

  async onUserSignOut(): Promise<void> {
    // Signing out, block screen capture
    await internalManager.setScreenCapture(false);
    this.lockTimeoutSeconds = DEFAULT_LOCK_TIMEOUT_SECONDS;
  }

  /* -------------------------- Auto-lock -------------------------- */

  private lockPasswordDatabase(): void {
    if (!DIDSessionsStore.signedInDIDString) {
      return;
    }
    Logger.log('security', 'Auto-locking the password database');
    void this.passwordService.lockMasterPassword();
  }

  private async refreshLockTimeoutCache(did: string): Promise<void> {
    try {
      this.lockTimeoutSeconds = await this.prefs.getPreference(did, NetworkTemplateStore.networkTemplate, 'security.lockTimeout');
    } catch (e) {
      Logger.warn('security', 'Could not read security.lockTimeout, using default', e);
      this.lockTimeoutSeconds = DEFAULT_LOCK_TIMEOUT_SECONDS;
    }
  }

  /** The current auto-lock timeout in seconds (0 = lock every time the app is backgrounded). */
  public getLockTimeoutSeconds(): number {
    return this.lockTimeoutSeconds;
  }

  /** Persists a new auto-lock timeout (seconds) and refreshes the in-memory cache. */
  public async setLockTimeoutSeconds(seconds: number): Promise<void> {
    this.lockTimeoutSeconds = seconds;
    await this.prefs.setPreference(DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, 'security.lockTimeout', seconds);
  }

  /**
   * Tells whether the user has been warned about the device being a rooted device. User must have
   * confirmed the warning manually.
   */
  public rootedDeviceWarningWasDismissed(): Promise<boolean> {
    return this.storage.getSetting(null, null, "security", "rooteddevicewarningdismissed", false);
  }

  public setRootedDeviceWarningDismissed(): Promise<void> {
    return this.storage.setSetting(null, null, "security", "rooteddevicewarningdismissed", true);
  }

  /**
   * Tells whether the device is rooted (android) or jailbroken (ios).
   * The detection is not 100% guaranteed but tries to warn most users with rooted devices
   * that they are taking risks by doing so.
   */
  public async isDeviceRooted(): Promise<boolean> {
    let ret = await internalManager.isDeviceRooted();
    Logger.log("security", "Is device rooted?", ret);
    return ret;
  }

  /**
   * Enables or disables screenshots/video capture for the current user DID session.
   */
  public async setScreenCaptureAllowed(allowScreenCapture: boolean): Promise<void> {
    await this.prefs.setPreference(DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, "developer.screencapture", allowScreenCapture);
    return internalManager.setScreenCapture(allowScreenCapture);
  }

  /**
   * Tells if the current user has allowed screenshots/video capture.
   */
  public getScreenCaptureAllowed(): Promise<boolean> {
    return this.prefs.getPreference(DIDSessionsStore.signedInDIDString, NetworkTemplateStore.networkTemplate, "developer.screencapture");
  }

  private async restoreScreenCapture(): Promise<void> {
    await internalManager.setScreenCapture(await this.getScreenCaptureAllowed());
  }
}
