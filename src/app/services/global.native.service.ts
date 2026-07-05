import { Injectable } from "@angular/core";
import { STD_TOAST_CLASS } from './theming/tokens';
import { Clipboard } from "@awesome-cordova-plugins/clipboard/ngx";
import {
  AlertController,
  LoadingController,
  ModalController,
  ToastController,
} from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { GlobalThemeService } from "src/app/services/theming/global.theme.service";
import {
  MenuSheetComponent,
  MenuSheetMenu,
} from "../components/menu-sheet/menu-sheet.component";

@Injectable({
  providedIn: "root",
})
export class GlobalNativeService {
  public static instance: GlobalNativeService;

  public loader: HTMLIonLoadingElement = null;
  public alert = null;
  private alertCtrlCreating = false;
  private loadingCtrlCreating = false;

  constructor(
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private translate: TranslateService,
    private theme: GlobalThemeService,
    private modalCtrl: ModalController,
    private clipboard: Clipboard
  ) {
    GlobalNativeService.instance = this;
  }

  copyClipboard(text: string) {
    return this.clipboard.copy(text);
  }

  pasteFromClipboard() {
    return this.clipboard.paste();
  }

  /** Creates and presents a toast with the app-wide base options applied. */
  private presentToast(options: { header: string; message?: string; duration: number; color: string }) {
    void this.toastCtrl
      .create({
        mode: "ios",
        cssClass: STD_TOAST_CLASS,
        position: "bottom",
        ...options,
      })
      .then((toast) => toast.present());
  }

  errToast(msg: string, duration = 3000) {
    this.presentToast({ header: this.translate.instant(msg), duration, color: "danger" });
  }

  genericToast(msg: string, duration = 2000) {
    this.presentToast({ header: this.translate.instant(msg), duration, color: "primary" });
  }

  toastWithTitle(
    header: string,
    msg: string,
    duration = 2000,
    color = "primary"
  ) {
    this.presentToast({
      header: this.translate.instant(header),
      message: this.translate.instant(msg),
      duration,
      color,
    });
  }

  async genericAlert(msg: string, title?: string, skipIfAlreadyPopup = false) {
    if (skipIfAlreadyPopup && (this.alert || this.alertCtrlCreating)) {
      return;
    }

    this.alertCtrlCreating = true;
    await this.hideAlert();
    this.alert = await this.alertCtrl.create({
      mode: "ios",
      header: title ? this.translate.instant(title) : null,
      message: this.translate.instant(msg),
      cssClass: "custom-alert",
      buttons: ["OK"],
    });
    this.alert.onWillDismiss().then(() => {
      this.alert = null;
    });
    this.alertCtrlCreating = false;
    return await this.alert.present();
  }

  public async hideAlert() {
    if (this.alert) {
      await this.alert.dismiss();
      this.alert = null;
    }
  }

  public async showLoading(message = "common.please-wait") {
    let isDarkMode = this.theme.activeTheme.value.config.usesDarkMode;
    if (this.loadingCtrlCreating) {
      // Just in case.
      return;
    }
    await this.hideLoading();

    this.loadingCtrlCreating = true;
    this.loader = await this.loadingCtrl.create({
      mode: "ios",
      translucent: false,
      spinner: "crescent",
      cssClass: !isDarkMode ? "custom-loader" : "dark-custom-loader",
      message: this.translate.instant(message),
      // cssClass: !isDarkMode ? 'custom-loader-wrapper' : 'dark-custom-loader-wrapper',
      // message: !isDarkMode ? '<div class="custom-loader"><div class="lds-dual-ring"><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div><ion-label>' + this.translate.instant(message) + '</ion-label></div>' : '<div class="dark-custom-loader"><div class="dark-lds-dual-ring"><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div><ion-label>' + this.translate.instant(message) + '</ion-label></div>',
    });
    void this.loader.onWillDismiss().then(() => {
      this.loader = null;
    });
    this.loadingCtrlCreating = false;
    return await this.loader.present();
  }

  public async hideLoading() {
    if (this.loader) {
      await this.loader.dismiss();
      this.loader = null;
    }
  }

  /**
   * Shows a generic bottom sheet component that can display menus and sub-menus to finally
   * pick one option in the menus.
   */
  public async showGenericBottomSheetMenuChooser(
    menu: MenuSheetMenu,
    options?: { autoHeight?: boolean }
  ): Promise<void> {
    // Determine CSS class based on options and menu items count
    let cssClass: string;
    const itemCount = menu.items?.length || 0;

    if (options?.autoHeight || itemCount > 3) {
      // Use auto height for menus with more than 3 items
      cssClass = !this.theme.darkMode
        ? "menu-chooser-component-larger"
        : "menu-chooser-component-larger-dark";
    } else {
      cssClass = !this.theme.darkMode
        ? "menu-chooser-component"
        : "menu-chooser-component-dark";
    }

    const modal = await this.modalCtrl.create({
      component: MenuSheetComponent,
      componentProps: {
        menu,
      },
      backdropDismiss: true, // Closeable
      cssClass: cssClass,
    });

    void modal.onDidDismiss().then((response: { data?: boolean }) => {});

    void modal.present();
  }
}
