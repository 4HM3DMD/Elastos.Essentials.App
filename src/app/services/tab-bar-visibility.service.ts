import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Keyboard } from '@awesome-cordova-plugins/keyboard/ngx';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { GlobalIntentService } from './global.intent.service';
import { GlobalPreferencesService } from './global.preferences.service';
import { DIDSessionsStore } from './stores/didsessions.store';
import { NetworkTemplateStore } from './stores/networktemplate.store';

// Route prefixes where the global bottom tab bar must be hidden: onboarding and
// the scanner (full-screen, no signed-in shell), any intent request screen, the
// dApp browser (its native webview paints over the DOM on Android), and the two
// modules that render their own bottom tab bar (would otherwise double up).
const HIDE_TABBAR_ROUTE_PREFIXES = [
  '/didsessions/',
  '/scanner/',
  '/intents/',
  '/dappbrowser/',
  '/identity/myprofile/',
  '/dpos2/menu/'
];

/**
 * Decides whether the global bottom tab bar is visible. It combines the current
 * route, the keyboard state, whether an intent is being answered, whether a user
 * is signed in, and the ui.tabbar kill-switch preference. It also mirrors the
 * result onto a `has-tabbar` class on <body> so content can reserve bottom space.
 */
@Injectable({
  providedIn: 'root'
})
export class TabBarVisibilityService {
  private currentUrl$ = new BehaviorSubject<string>('/');
  private keyboardOpen$ = new BehaviorSubject<boolean>(false);
  private tabBarEnabled$ = new BehaviorSubject<boolean>(true);
  // Stays false until the kill-switch preference has been read once, so a user who
  // turned the bar off never sees it flash on at launch.
  private prefLoaded$ = new BehaviorSubject<boolean>(false);

  public isVisible$: Observable<boolean>;

  private initialized = false;

  constructor(
    private router: Router,
    private keyboard: Keyboard,
    private intentService: GlobalIntentService,
    private prefs: GlobalPreferencesService
  ) {}

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const url = e.urlAfterRedirects || e.url;
        // Returning to the launcher home means no intent request screen is up, so
        // recover a stuck unanswered-intent flag (an intent dismissed without answering).
        if (url.startsWith('/launcher/home')) this.intentService.resetUnansweredIntentFlagIfStuck();
        this.currentUrl$.next(url);
      });

    this.keyboard.onKeyboardWillShow().subscribe(() => this.keyboardOpen$.next(true));
    this.keyboard.onKeyboardWillHide().subscribe(() => this.keyboardOpen$.next(false));

    // Follow the kill-switch preference (changes apply live).
    this.prefs.preferenceListener.subscribe(pref => {
      if (pref.key === 'ui.tabbar') this.tabBarEnabled$.next(pref.value as boolean);
    });

    this.isVisible$ = combineLatest([
      this.currentUrl$,
      this.keyboardOpen$,
      this.intentService.hasUnansweredIntent$,
      this.tabBarEnabled$,
      this.prefLoaded$
    ]).pipe(
      map(([url, keyboardOpen, hasIntent, enabled, prefLoaded]) =>
        prefLoaded && this.computeVisible(url, keyboardOpen, hasIntent, enabled)),
      distinctUntilChanged()
    );

    this.isVisible$.subscribe(visible => {
      document.body.classList.toggle('has-tabbar', visible);
    });
  }

  /** Re-reads the kill-switch preference for the signed-in user. */
  public async refreshPreference(): Promise<void> {
    try {
      const enabled = await this.prefs.getPreference(
        DIDSessionsStore.signedInDIDString,
        NetworkTemplateStore.networkTemplate,
        'ui.tabbar'
      );
      this.tabBarEnabled$.next(enabled as boolean);
    } catch (e) {
      // Not signed in yet or preference unavailable: keep the current value.
    } finally {
      this.prefLoaded$.next(true);
    }
  }

  private computeVisible(url: string, keyboardOpen: boolean, hasIntent: boolean, enabled: boolean): boolean {
    if (!enabled) return false;
    if (!DIDSessionsStore.signedInDIDString) return false;
    if (keyboardOpen) return false;
    if (hasIntent) return false;
    return !HIDE_TABBAR_ROUTE_PREFIXES.some(prefix => url.startsWith(prefix));
  }
}
