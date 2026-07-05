import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { App } from 'src/app/model/app.enum';
import { GlobalNavService } from 'src/app/services/global.nav.service';

type TabKey = 'home' | 'wallet' | 'apps' | 'activity' | 'menu';

/**
 * The global bottom tab bar. Its visibility is owned by TabBarVisibilityService
 * (the shell only renders it when that says so). Each tab resets the navigation
 * stack to its own root; Activity opens the notifications modal instead.
 */
@Component({
  selector: 'ui-tab-bar',
  templateUrl: './ui-tab-bar.component.html',
  styleUrls: ['./ui-tab-bar.component.scss']
})
export class UiTabBarComponent implements OnInit, OnDestroy {
  public active: TabKey = 'home';

  private routerSub: Subscription = null;
  private activityModalOpen = false;

  constructor(
    private router: Router,
    private globalNav: GlobalNavService,
    private modalCtrl: ModalController
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

  private syncActive(url: string): void {
    if (url.startsWith('/wallet')) this.active = 'wallet';
    else if (url.startsWith('/settings')) this.active = 'menu';
    else if (url.startsWith('/launcher/home')) this.active = 'home';
    // Apps + Activity have no dedicated landing route yet, so they never latch.
  }

  public async onHome(): Promise<void> {
    this.globalNav.clearNavigationHistory();
    await this.globalNav.navigateHome();
  }

  public async onWallet(): Promise<void> {
    this.globalNav.clearNavigationHistory();
    await this.globalNav.navigateRoot(App.WALLET, '/wallet/wallet-home');
  }

  public async onApps(): Promise<void> {
    // TODO WO-33: route to the dedicated Apps hub once it exists.
    this.globalNav.clearNavigationHistory();
    await this.globalNav.navigateHome();
  }

  public async onActivity(): Promise<void> {
    if (this.activityModalOpen) return;
    this.activityModalOpen = true;
    const { NotificationsPage } = await import('src/app/launcher/pages/notifications/notifications.page');
    const modal = await this.modalCtrl.create({
      component: NotificationsPage,
      cssClass: 'running-modal',
      mode: 'ios'
    });
    void modal.onDidDismiss().then(() => (this.activityModalOpen = false));
    await modal.present();
  }

  public async onMenu(): Promise<void> {
    this.globalNav.clearNavigationHistory();
    await this.globalNav.navigateRoot(App.SETTINGS, '/settings/menu');
  }
}
