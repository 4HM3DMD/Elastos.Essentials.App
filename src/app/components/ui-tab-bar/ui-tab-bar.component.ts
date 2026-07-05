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
    if (url.startsWith('/wallet')) this.active = 'wallet';
    else if (url.startsWith('/settings')) this.active = 'menu';
    else if (UiTabBarComponent.ELASTOS_CONTEXT_PREFIXES.some(p => url.startsWith(p))) this.active = 'elastos';
    else if (url.startsWith('/dappbrowser')) this.active = 'browser';
    else if (url.startsWith('/launcher/home')) this.active = 'home';
  }

  public async onHome(): Promise<void> {
    this.globalNav.clearNavigationHistory();
    await this.globalNav.navigateHome();
  }

  public async onWallet(): Promise<void> {
    this.globalNav.clearNavigationHistory();
    await this.globalNav.navigateRoot(App.WALLET, '/wallet/wallet-home');
  }

  public async onElastos(): Promise<void> {
    // Unlike the other tabs the hub keeps the caller in history, so both the
    // titlebar arrow and the Android hardware back return to the origin screen.
    this.globalNav.clearIntermediateRoutes(['/launcher/elastos']);
    await this.globalNav.navigateTo(App.LAUNCHER, '/launcher/elastos');
  }

  public async onBrowser(): Promise<void> {
    this.globalNav.clearNavigationHistory();
    await this.globalNav.navigateRoot(App.DAPP_BROWSER, '/dappbrowser/home');
  }

  public async onMenu(): Promise<void> {
    this.globalNav.clearNavigationHistory();
    await this.globalNav.navigateRoot(App.SETTINGS, '/settings/menu');
  }
}
