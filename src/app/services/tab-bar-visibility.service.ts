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
// active dApp browsing session and its menu (the native webview paints over the
// DOM on Android; the browser HOME is a plain page and keeps the bar), and the
// modules that render their own bottom chrome — local tab bars (identity, dpos2)
// or fixed bottom action buttons (staking ion-footer, council vote button) that
// the global bar would cover.
const HIDE_TABBAR_ROUTE_PREFIXES = [
  '/didsessions/',
  '/scanner/',
  '/intents/',
  '/dappbrowser/browser',
  '/dappbrowser/menu',
  '/dappbrowser/edit-favorite',
  '/identity/myprofile/',
  '/dpos2/menu/',
  '/staking/',
  '/crcouncilvoting/'
];

// Exact routes (matched against the path, ignoring query/state) where the bar is
// hidden. The token-detail page '/wallet/coin' is an immersive pushed detail
// (back chevron, in-flow action tiles) - a detail page does not carry the root
// tab bar. If it is ever unhidden, coin-home.page.scss must drop its page-scoped
// --padding-bottom, which otherwise beats the global has-tabbar clearance and
// leaves the last rows under the bar. An exact match keeps its '/wallet/coin-*'
// siblings (receive, tx-info, ...) unaffected. The send screen
// '/wallet/coin-transfer' is a full-height composition (amount + numpad + address
// + pinned Continue) with no room for the bar, matching the Figma Send frames.
// The remaining entries are pushed sub-pages whose primary CTA is pinned to the
// bottom band the floating bar overlays: the wallet token add/details/name
// screens (ion-footer or fixed Delete/Share buttons), the dpos2 voting screen
// (its local tab bar lives under /dpos2/menu/ and is untouched), and the
// Elastos DAO detail + command screens - their fixed sign/vote footers also
// appear OUTSIDE intent flows (CR-member commands from the detail pages, scan),
// so the intent-based hide does not cover them. The DAO list pages
// (/crproposalvoting/proposals|suggestions) keep the bar: browse destinations,
// no bottom chrome. Route spellings follow crproposalvoting/routing.ts:
// 'proposal-details' (plural) but 'suggestion-detail' (singular).
const HIDE_TABBAR_EXACT_ROUTES = [
  '/wallet/coin',
  '/wallet/coin-transfer',
  '/wallet/coin-add-erc20',
  '/wallet/coin-erc20-details',
  '/wallet/wallet-create-name',
  '/dpos2/vote',
  '/crproposalvoting/proposal-details',
  '/crproposalvoting/suggestion-detail',
  '/crproposalvoting/createsuggestion',
  '/crproposalvoting/createproposal',
  '/crproposalvoting/reviewproposal',
  '/crproposalvoting/voteforproposal',
  '/crproposalvoting/updatemilestone',
  '/crproposalvoting/reviewmilestone',
  '/crproposalvoting/withdraw'
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
    if (HIDE_TABBAR_ROUTE_PREFIXES.some(prefix => url.startsWith(prefix))) return false;
    const path = url.split('?')[0];
    return !HIDE_TABBAR_EXACT_ROUTES.includes(path);
  }
}
