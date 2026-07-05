import { Injectable } from '@angular/core';
import { StatusBar } from '@awesome-cordova-plugins/status-bar/ngx';
import { Platform } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { IdentityEntry } from '../../model/didsessions/identityentry';
import { Logger } from '../../logger';
import { GlobalPreferencesService } from '../global.preferences.service';
import { GlobalService, GlobalServiceManager } from '../global.service.manager';
import { DIDSessionsStore } from '../stores/didsessions.store';
import { NetworkTemplateStore } from '../stores/networktemplate.store';
import { ThemeConfig } from './theme';
import { availableThemes } from './themes';
import {
  ACCENT, ACCENT_INK,
  ALPHA_SECONDARY_ON_DARK, ALPHA_SECONDARY_ON_LIGHT, ALPHA_TERTIARY,
  DANGER_ON_DARK, DANGER_ON_LIGHT,
  DEFAULT_THEME_KEY,
  PILLAR_APPS, PILLAR_IDENTITY,
  SIGNED_OUT_THEME_KEY,
  SUCCESS_ON_DARK, SUCCESS_ON_LIGHT
} from './tokens';

const RGB_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export enum GlobalThemeMode {
  LIGHT,
  DARK
}

export type ActiveTheming = {
  config: ThemeConfig;
  variant: 'light' | 'dark';
};

declare let passwordManager: PasswordManagerPlugin.PasswordManager;

@Injectable({
  providedIn: 'root'
})
export class GlobalThemeService extends GlobalService {
  public activeTheme = new BehaviorSubject<ActiveTheming>({
    config: this.defaultThemeConfig().theme,
    variant: this.defaultThemeConfig().themeVariant
  });

  constructor(
    private prefs: GlobalPreferencesService,
    private platform: Platform,
    private statusBar: StatusBar
  ) {
    super();

    void this.platform.ready().then(() => {
      // Default theme is dark.
      void passwordManager.setDarkMode(true);
    });
  }

  public init() {
    GlobalServiceManager.getInstance().registerService(this);

    // Apply a default theme, when no user is signed in
    void this.applyThemeConfig(this.activeTheme.value.config, this.activeTheme.value.variant);
  }

  public async onUserSignIn(signedInIdentity: IdentityEntry): Promise<void> {
    // Re-apply the theme for the active user.
    await this.fetchThemeFromPreferences();
  }

  public async onUserSignOut(): Promise<void> {
    let { theme, themeVariant } = this.defaultThemeConfig();
    await this.applyThemeConfig(theme, themeVariant);
  }

  public async fetchThemeFromPreferences() {
    let themeKey = await this.prefs.getPreference(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'ui.theme'
    );
    let themeConfig = availableThemes.find(theme => theme.key === themeKey);

    // Users may have a retired theme key persisted (legacy novelty themes).
    // Fall back to the signed-in default, otherwise applyThemeConfig() would
    // dereference undefined and break sign-in.
    let themeKeyMigrated = false;
    if (!themeConfig) {
      themeConfig = availableThemes.find(theme => theme.key === DEFAULT_THEME_KEY);
      themeKeyMigrated = true;
    }

    let themeVariant = await this.prefs.getPreference(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'ui.variant'
    );
    // The variant axis is not user-facing anymore (Dark/Light themes only):
    // normalize everything to the canonical 'light' variant palettes.
    let variantMigrated = false;
    if (themeVariant !== 'light') {
      themeVariant = 'light';
      variantMigrated = true;
    }

    // Apply first: theming must never depend on storage writes succeeding.
    await this.applyThemeConfig(themeConfig, themeVariant);

    // Persist the corrected values best-effort, so the migration happens once.
    try {
      if (themeKeyMigrated) {
        await this.prefs.setPreference(
          DIDSessionsStore.signedInDIDString,
          NetworkTemplateStore.networkTemplate,
          'ui.theme',
          themeConfig.key
        );
      }
      if (variantMigrated) {
        await this.prefs.setPreference(
          DIDSessionsStore.signedInDIDString,
          NetworkTemplateStore.networkTemplate,
          'ui.variant',
          themeVariant
        );
      }
    } catch (e) {
      Logger.warn('theme', 'Could not persist migrated theme preference', e);
    }
  }

  public get darkMode() {
    return this.activeTheme.value.config.usesDarkMode;
  }

  public getAvailableThemeConfigs(): ThemeConfig[] {
    return availableThemes;
  }

  private defaultThemeConfig(): { theme: ThemeConfig; themeVariant: 'light' | 'dark' } {
    // Signed-out (DID sessions / onboarding) theme. Stays light until those screens
    // support dark surfaces (doc 144 WO-17); the signed-in default is DEFAULT_THEME_KEY
    // via the 'ui.theme' preference default.
    let signedOutTheme = availableThemes.find(theme => theme.key === SIGNED_OUT_THEME_KEY);
    return { theme: signedOutTheme, themeVariant: 'light' };
  }

  /**
   * Applies a theme without persisting
   */
  async applyThemeConfig(theme: ThemeConfig, themeVariant: 'light' | 'dark') {
    let variant = theme.variants[themeVariant];

    // mainTextColor format must be #RRGGBB
    let mainTextColor: string = null;
    if (theme.usesDarkMode) {
      mainTextColor = variant.textColor || '#FFFFFF';
    } else {
      mainTextColor = variant.textColor || '#000000';
    }

    document.body.style.setProperty(
      '--essentials-box-color',
      variant.boxColor || (themeVariant === 'light' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
    );
    document.body.style.setProperty('--essentials-border-separator-color', `${mainTextColor}30`); // Semi transparent based on text color
    document.body.style.setProperty('--essentials-pagination-color', `${mainTextColor}B0`); // Semi transparent based on text color
    document.body.style.setProperty('--essentials-pagination-active-color', `${mainTextColor}`);
    document.body.style.setProperty(
      '--essentials-button-background-color',
      variant.buttonBackgroundColor || mainTextColor
    );
    document.body.style.setProperty('--essentials-button-text-color', variant.buttonTextColor || variant.color);

    // Semantic tokens derived from the palette (doc 144 II.1). The accent pair follows
    // the theme's own button colors so themes stay the single source of truth.
    document.body.style.setProperty(
      '--essentials-text-secondary',
      `${mainTextColor}${theme.usesDarkMode ? ALPHA_SECONDARY_ON_DARK : ALPHA_SECONDARY_ON_LIGHT}`
    );
    document.body.style.setProperty('--essentials-text-tertiary', `${mainTextColor}${ALPHA_TERTIARY}`);
    document.body.style.setProperty('--essentials-accent', variant.buttonBackgroundColor || ACCENT);
    document.body.style.setProperty('--essentials-accent-ink', variant.buttonTextColor || ACCENT_INK);
    document.body.style.setProperty(
      '--essentials-success',
      variant.successColor || (theme.usesDarkMode ? SUCCESS_ON_DARK : SUCCESS_ON_LIGHT)
    );
    document.body.style.setProperty(
      '--essentials-danger',
      variant.dangerColor || (theme.usesDarkMode ? DANGER_ON_DARK : DANGER_ON_LIGHT)
    );
    document.body.style.setProperty('--essentials-pillar-identity', PILLAR_IDENTITY);
    document.body.style.setProperty('--essentials-pillar-apps', PILLAR_APPS);

    // Set ionic background color and variants
    document.body.style.setProperty('--ion-text-color', mainTextColor);
    document.body.style.setProperty('--ion-color-primary', mainTextColor);
    document.body.style.setProperty('--ion-card-color', mainTextColor);
    document.body.style.setProperty('--ion-item-color', mainTextColor);
    document.body.style.setProperty('--ion-background-color', variant.color);
    document.body.style.setProperty('--ion-item-background', variant.color);
    document.body.style.setProperty('--ion-item-border-color', `${mainTextColor}30`); // Semi transparent based on text color
    document.body.style.setProperty('--ion-color-step-50', variant.color);
    document.body.style.setProperty('--ion-color-step-100', variant.color);
    document.body.style.setProperty('--ion-color-step-150', variant.color);
    document.body.style.setProperty('--ion-color-step-200', variant.color);
    document.body.style.setProperty('--ion-color-step-250', variant.color);
    // Are other needed up to 950 ?

    // Native chrome follows the theme. All native theming side effects live here,
    // next to each other, so they cannot drift apart.
    await passwordManager.setDarkMode(theme.usesDarkMode);
    this.applyNativeStatusBar(variant.color, theme.usesDarkMode);

    // The document background is what shows on overscroll/rotation gaps; the static
    // BackgroundColor preference in config.xml only covers the pre-bootstrap moment.
    document.documentElement.style.backgroundColor = variant.color;

    // Notify
    this.activeTheme.next({
      config: theme,
      variant: themeVariant
    });
  }

  /**
   * Sets the native status bar background and pairs the icon style with the theme
   * darkness (light icons on dark backgrounds, dark icons on light backgrounds).
   */
  private applyNativeStatusBar(backgroundColor: string, usesDarkMode: boolean) {
    if (RGB_HEX_COLOR.test(backgroundColor)) {
      this.statusBar.backgroundColorByHexString('#ff' + backgroundColor.substring(1));
    } else {
      Logger.warn('theme', 'Theme background is not #RRGGBB, keeping previous status bar color:', backgroundColor);
    }

    if (usesDarkMode) {
      this.statusBar.styleLightContent(); // light icons
    } else {
      this.statusBar.styleDefault(); // dark icons
    }
  }

  /**
   * Switches between the dark and light themes. This is the only user-facing
   * theme control (the theme picker was removed with the novelty themes).
   */
  public async toggleDarkLight() {
    let target = availableThemes.find(theme => theme.usesDarkMode !== this.darkMode);
    if (target)
      await this.setThemeConfig(target);
  }

  /**
   * Applies a new theme and make it persisting
   */
  public async setThemeConfig(theme: ThemeConfig) {
    let themeVariant = this.activeTheme.value.variant;

    // Persist
    await this.prefs.setPreference(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      'ui.theme',
      theme.key
    );

    // Apply
    void this.applyThemeConfig(theme, themeVariant);
  }

}
