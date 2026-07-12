import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { BehaviorSubject, Subject } from 'rxjs';
import { IdentityEntry } from '../model/didsessions/identityentry';
import { GlobalService, GlobalServiceManager } from './global.service.manager';
import { GlobalStorageService } from './global.storage.service';
import { NetworkTemplateStore } from './stores/networktemplate.store';

export interface AllPreferences {
  /** Language locale */
  'locale.language': string;
  /** Developer mode for external developers using essentials to build dapps */
  'developer.mode': boolean;
  /** @deprecated Whether to verify digest during developer installs (elastos capsules) */
  'developer.install.verifyDigest': boolean;
  /** Whether to start background services on boot */
  'developer.backgroundservices.startonboot': boolean;
  /** Whether to allow screen capture */
  'developer.screencapture': boolean;
  /** Whether to collect logs */
  'developer.collectLogs': boolean;
  /** Whether to allow dangerous Bitcoin sign data operations */
  'privacy.bitcoinSignData': boolean;
  /** Whether to use built-in browser (Android uses built-in, iOS uses external) */
  'privacy.browser.usebuiltin': boolean;
  /** Core developer mode for essentials developers or testers to access dev/tests screens */
  'developer.core.mode': boolean;
  /** Identity publication medium: 'assist' or 'wallet' */
  'privacy.identity.publication.medium': 'assist' | 'wallet';
  /** Whether to publish anonymous stats about credentials usage to external credential toolbox service */
  'privacy.credentialtoolbox.stats': boolean;
  /** Whether to allow data to be synchronized with the hive vault (credentials, contacts, etc) */
  'privacy.hive.sync': boolean;
  /** True for dark mode, false for light mode - legacy way to use binary light or dark modes (before colors). Now used to change the overall white or dark modes for pictures, in colored themes */
  'ui.darkmode': boolean;
  /** Key of the main overall theme. Changing this theme also impacts the darkmode value. Color code name eg: "blue" */
  'ui.theme': string;
  /** Light or dark variant. The variant changes the box colors mostly for now */
  'ui.variant': 'light' | 'dark';
  /** Whether to use lightweight UI mode (all elastos or advanced features hidden) */
  'ui.lightweight': boolean;
  'ui.tabbar': boolean;
  'ui.hidebalances': boolean;
  /** All-chains aggregate view on the home and wallet token lists (vs a single active network) */
  'ui.allchains': boolean;
  /** Startup screen setting */
  'ui.startupscreen': string;
  'network.template': string;
  'chain.network.config': string;
  'chain.network.configurl': string;
  /** Elastos API provider */
  'elastosapi.provider': string;
  /** Whether to show daily tips (notifications) */
  'help.dailytips.show': boolean;
  /** Whether to enable creating red packets (removed on iOS due to Apple policy) */
  'privacy.redpacket.create': boolean;
  /** Auto-lock the password database after this many seconds in the background. 0 = lock
   *  immediately (require the master password every time the app returns). */
  'security.lockTimeout': number;
}

export type PreferenceKey = keyof AllPreferences;

export type Preference<T extends PreferenceKey> = {
  key: T;
  value: AllPreferences[T];
};

@Injectable({
  providedIn: 'root'
})
export class GlobalPreferencesService implements GlobalService {
  public static instance: GlobalPreferencesService; // Convenient way to get this service from non-injected classes

  // Generic subject, call only when a preference is actually modified
  public preferenceListener = new Subject<Preference<PreferenceKey>>();

  // Specific subjects, called when signing in and when preferences change.
  public useHiveSync = new BehaviorSubject<boolean>(false); // Whether to sync Essentials user data with the hive vault or not

  constructor(private storage: GlobalStorageService, private platform: Platform) {
    GlobalPreferencesService.instance = this;
    GlobalServiceManager.getInstance().registerService(this);
  }

  async onUserSignIn(signedInIdentity: IdentityEntry): Promise<void> {
    // Emit a few subjects.
    // Hive data sync is being retired and its control UI (privacy toggle + widget) is gone,
    // so migrate any still-enabled preference to false to stop invisible background sync.
    let useHiveSync = await this.getPreference(signedInIdentity.didString, NetworkTemplateStore.networkTemplate, 'privacy.hive.sync');
    if (useHiveSync) {
      await this.setPreference(signedInIdentity.didString, NetworkTemplateStore.networkTemplate, 'privacy.hive.sync', false);
      useHiveSync = false;
    }
    this.useHiveSync.next(useHiveSync);
  }

  onUserSignOut(): Promise<void> {
    this.useHiveSync.next(false);
    return;
  }

  private getDefaultPreferences(did: string): AllPreferences {
    let isAndroid = this.platform.platforms().indexOf('android') >= 0;
    // By default, because of app store policy reasons, android uses the built in browser,
    // while ios uses external browsers to open urls.
    const useBuiltInBrowser = isAndroid ? true : false;

    const enableCreatingRedPacket = isAndroid ? true : false;

    return {
      'locale.language': 'native system',
      'developer.mode': false,
      'developer.install.verifyDigest': false,
      'developer.backgroundservices.startonboot': true,
      'developer.screencapture': false,
      'developer.collectLogs': false,
      // Blind signing of unreadable bitcoin signData requests is a phishing/fund-loss
      // risk (see the privacy screen's own warning), so it must be an explicit opt-in.
      'privacy.bitcoinSignData': false,
      'privacy.browser.usebuiltin': useBuiltInBrowser,
      'developer.core.mode': false,
      'privacy.identity.publication.medium': 'assist',
      'privacy.credentialtoolbox.stats': false,
      'privacy.hive.sync': false,
      'ui.darkmode': true,
      'ui.theme': 'black', // Dark-first default (doc 144 D2); retired theme keys migrate in GlobalThemeService
      'ui.variant': 'light',
      'ui.lightweight': false, // Lightweight mode retired (WO-5); kept for the one-time migration in WidgetsService
      'ui.tabbar': true, // Bottom tab bar (WO-7); kill switch via developer tools
      'ui.hidebalances': false, // Mask wallet balances (WO-8)
      'ui.allchains': true, // All-chains aggregate view is the default experience

      'ui.startupscreen': 'home',
      'network.template': 'MainNet',
      'chain.network.config': '',
      'chain.network.configurl': '',
      'elastosapi.provider': 'elastosio',
      'help.dailytips.show': true,
      'privacy.redpacket.create': enableCreatingRedPacket,
      // 5 minutes by default: re-lock the password database after being backgrounded this
      // long, so returning to the app re-prompts for the master password on sensitive access.
      'security.lockTimeout': 300
    };
  }

  /**
   * Tells if a given preference was saved to persistent storage or if we may use the default value instead.
   */
  public async preferenceIsSet(did: string, networkTemplate: string, key: PreferenceKey) {
    let diskPreferences = await this.storage.getSetting<AllPreferences>(
      did,
      networkTemplate,
      'prefservice',
      'preferences',
      this.getDefaultPreferences(did)
    );
    return key in diskPreferences;
  }

  /**
   * Get a specific system preference. System preferences setting shared by all parts of the app.
   *
   * @param key Unique key identifying the preference data.
   */
  public async getPreference<K extends PreferenceKey>(
    did: string,
    networkTemplate: string,
    key: K,
    allowNullDID = false
  ): Promise<AllPreferences[K]> {
    if (did == null && !allowNullDID)
      throw new Error(
        'Getting a global preference (no DID set) without allowNullDID set to false is forbidden! key= ' + key
      );

    if (!(key in this.getDefaultPreferences(did)))
      throw new Error('Preference ' + key + ' is not a registered preference!');

    let preferences = await this.getPreferences(did, networkTemplate, allowNullDID);
    if (!(key in preferences)) throw new Error('Preference ' + key + ' is not a registered preference!');

    //Logger.log('PreferenceService', "GET PREF", key, preferences[key])

    return preferences[key];
  }

  /**
   * Get all system preferences.
   */
  public async getPreferences(did: string, networkTemplate: string, allowNullDID = false): Promise<AllPreferences> {
    if (did == null && !allowNullDID)
      throw new Error('Getting global preferences (no DID set) without allowNullDID set to false is forbidden!');

    let diskPreferences = await this.storage.getSetting<AllPreferences>(
      did,
      networkTemplate,
      'prefservice',
      'preferences',
      this.getDefaultPreferences(did)
    );

    //Logger.log('PreferenceService', "DISK PREFS", did, diskPreferences)

    // Merge saved preferences with default values
    return Object.assign({}, this.getDefaultPreferences(did), diskPreferences);
  }

  /**
   * Set specific system preference.
   *
   * @param key   Unique key identifying the preference data.
   * @param value The data to be stored. If null is passed, the preference is restored to system default value.
   */
  public async setPreference<K extends PreferenceKey>(
    did: string,
    networkTemplate: string,
    key: K,
    value: AllPreferences[K],
    allowNullDID = false
  ): Promise<void> {
    if (!(key in this.getDefaultPreferences(did)))
      throw new Error('Preference ' + key + ' is not a registered preference!');

    let preferences = await this.getPreferences(did, networkTemplate, allowNullDID);
    preferences[key] = value;

    await this.storage.setSetting<AllPreferences>(did, networkTemplate, 'prefservice', 'preferences', preferences);

    // Notify listeners about a preference change
    this.preferenceListener.next({ key, value });
  }

  /**
   * Delete all system preferences.
   * Call this when the did is deleted.
   */
  public async deletePreferences(did: string, networkTemplate: string, allowNullDID = false) {
    if (did == null && !allowNullDID)
      throw new Error('Getting global preferences (no DID set) without allowNullDID set to false is forbidden!');

    await this.storage.deleteSetting(did, networkTemplate, 'prefservice', 'preferences');
  }

  public async developerModeEnabled(did: string, networkTemplate: string): Promise<boolean> {
    try {
      let devMode = await this.getPreference(did, networkTemplate, 'developer.mode');
      if (devMode) return true;
      else return false;
    } catch (err) {
      return false;
    }
  }

  public getUseBuiltInBrowser(did: string, networkTemplate: string): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'privacy.browser.usebuiltin');
  }

  public setUseBuiltInBrowser(did: string, networkTemplate: string, useBuiltIn: boolean): Promise<void> {
    return this.setPreference(did, networkTemplate, 'privacy.browser.usebuiltin', useBuiltIn);
  }

  /** All-chains aggregate view (home and wallet token lists) vs single active network. */
  public getAllChainsMode(did: string, networkTemplate: string): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'ui.allchains');
  }

  public setAllChainsMode(did: string, networkTemplate: string, enabled: boolean): Promise<void> {
    return this.setPreference(did, networkTemplate, 'ui.allchains', enabled);
  }

  /**
   * Developer mode is for external developers that are using essentials to build their dapps.
   * Core developer mode is for essentials developers or testers.
   */
  public coreDeveloperModeEnabled(did: string, networkTemplate: string): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'developer.core.mode');
  }

  public setCoreDeveloperModeEnabled(did: string, networkTemplate: string, enabled: boolean): Promise<void> {
    return this.setPreference(did, networkTemplate, 'developer.core.mode', enabled);
  }

  public getPublishIdentityMedium(did: string, networkTemplate: string): Promise<string> {
    return this.getPreference(did, networkTemplate, 'privacy.identity.publication.medium');
  }

  public setPublishIdentityMedium(did: string, networkTemplate: string, medium: 'assist' | 'wallet'): Promise<void> {
    return this.setPreference(did, networkTemplate, 'privacy.identity.publication.medium', medium);
  }

  public getSendStatsToCredentialToolbox(did: string, networkTemplate: string): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'privacy.credentialtoolbox.stats');
  }

  public setSendStatsToCredentialToolbox(did: string, networkTemplate: string, sendStats: boolean): Promise<void> {
    return this.setPreference(did, networkTemplate, 'privacy.credentialtoolbox.stats', sendStats);
  }

  public getCollectLogs(did: string, networkTemplate: string = NetworkTemplateStore.networkTemplate): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'developer.collectLogs');
  }

  public setCollectLogs(did: string, networkTemplate: string, collectLogs: boolean): Promise<void> {
    return this.setPreference(did, networkTemplate, 'developer.collectLogs', collectLogs);
  }

  public getBitcoinSignData(
    did: string,
    networkTemplate: string = NetworkTemplateStore.networkTemplate
  ): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'privacy.bitcoinSignData');
  }

  public setBitcoinSignData(did: string, networkTemplate: string, bitcoinSignData: boolean): Promise<void> {
    return this.setPreference(did, networkTemplate, 'privacy.bitcoinSignData', bitcoinSignData);
  }

  public getUseHiveSync(did: string, networkTemplate: string = NetworkTemplateStore.networkTemplate): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'privacy.hive.sync');
  }

  public async setUseHiveSync(did: string, networkTemplate: string, useHiveSync: boolean): Promise<void> {
    await this.setPreference(did, networkTemplate, 'privacy.hive.sync', useHiveSync);
    this.useHiveSync.next(useHiveSync);
  }

  // Form 3.0.7, we remove the create button on iOS as apple complains about this.
  public getEnableCreatingOfRedPacket(did: string, networkTemplate: string): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'privacy.redpacket.create');
  }

  public setEnableCreatingOfRedPacket(did: string, networkTemplate: string, enable: boolean): Promise<void> {
    return this.setPreference(did, networkTemplate, 'privacy.redpacket.create', enable);
  }

  public getLightweightMode(did: string, networkTemplate: string, allowNullDID = false): Promise<boolean> {
    return this.getPreference(did, networkTemplate, 'ui.lightweight', allowNullDID);
  }
}
