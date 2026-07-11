import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { App } from 'src/app/model/app.enum';
import { GlobalNavService } from 'src/app/services/global.nav.service';

type TabKey = 'home' | 'wallet' | 'elastos' | 'browser' | 'menu';

/**
 * The global bottom tab bar. Its visibility is owned by TabBarVisibilityService
 * (the shell only renders it when that says so). Each tab resets the navigation
 * stack to its own root. The raised center button opens the Elastos hub.
 */
@Component({
  selector: 'ui-tab-bar',
  templateUrl: './ui-tab-bar.component.html',
  styleUrls: ['./ui-tab-bar.component.scss']
})
export class UiTabBarComponent implements OnInit, OnDestroy {
  public active: TabKey = 'home';

  private routerSub: Subscription = null;

  constructor(
    private router: Router,
    private globalNav: GlobalNavService
  ) {}

  public ngOnInit(): void {
    this.syncActive(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => this.syncActive(e.urlAfterRedirects || e.url));
  }

  public ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private static readonly ELASTOS_CONTEXT_PREFIXES = [
    '/launcher/elastos', '/staking', '/dpos2', '/crproposalvoting', '/crcouncilvoting', '/identity'
  ];

  private syncActive(url: string): void {
    // LOGIC:wrong-active-tab — the /wallet/settings/* screens (currency select,
    // manage networks, ...) are shared settings pages reachable from BOTH the
    // Settings tab and the Wallet tab. Do not flip the highlight to Wallet: keep
    // whichever tab the user was operating in when the sub-page was opened.
    if (url.startsWith('/wallet/settings')) return;
    if (url.startsWith('/wallet')) this.active = 'wallet';
    else if (url.startsWith('/settings')) this.active = 'menu';
    else if (UiTabBarComponent.ELASTOS_CONTEXT_PREFIXES.some(p => url.startsWith(p))) this.active = 'elastos';
    else if (url.startsWith('/dappbrowser')) this.active = 'browser';
    else if (url.startsWith('/launcher/home')) this.active = 'home';
  }

  // Every tab switches through navigateTabRoot: all five reset to their own root
  // and switch instantly (no forward-push slide), and the view stack is reset each
  // time instead of growing on every tap. The Hub (Elastos) is a tab root like the
  // others, so it shows no back control - users return via the tab bar.
  // Re-tapping the tab you are already on (exact root match, not just the same
  // section - from a section sub-page the tap must still pop to the root) is a
  // no-op instead of a pointless re-navigation.
  private async switchTab(context: App, route: string): Promise<void> {
    if (this.router.url === route) return;
    await this.globalNav.navigateTabRoot(context, route);
  }

  public onHome(): Promise<void> {
    return this.switchTab(App.LAUNCHER, '/launcher/home');
  }

  public onWallet(): Promise<void> {
    return this.switchTab(App.WALLET, '/wallet/wallet-home');
  }

  public onElastos(): Promise<void> {
    return this.switchTab(App.LAUNCHER, '/launcher/elastos');
  }

  public onBrowser(): Promise<void> {
    return this.switchTab(App.DAPP_BROWSER, '/dappbrowser/home');
  }

  public onMenu(): Promise<void> {
    return this.switchTab(App.SETTINGS, '/settings/menu');
  }
}
