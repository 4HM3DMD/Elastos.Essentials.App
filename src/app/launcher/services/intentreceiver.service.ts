import { Injectable, NgZone } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MenuController, ModalController, PopoverController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ContactsInitService } from 'src/app/contacts/services/init.service';
import { App } from 'src/app/model/app.enum';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalIntentService } from 'src/app/services/global.intent.service';
import { GlobalLanguageService } from 'src/app/services/global.language.service';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalStorageService } from 'src/app/services/global.storage.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { CRCouncilVotingInitService } from 'src/app/voting/crcouncilvoting/services/init.service';
import { WalletInitService } from 'src/app/wallet/services/init.service';
import { WalletNetworkService } from 'src/app/wallet/services/network.service';
import { DIDManagerService } from './didmanager.service';

@Injectable({
    providedIn: 'root'
})
export class IntentReceiverService {
    private intentSubscription: Subscription = null;

    constructor(
        private sanitizer: DomSanitizer,
        public zone: NgZone,
        public theme: GlobalThemeService,
        public popoverController: PopoverController,
        private modalController: ModalController,
        public menuCtrl: MenuController,
        private translate: TranslateService,
        private events: GlobalEvents,
        private didService: DIDManagerService,
        private native: GlobalNativeService,
        private storage: GlobalStorageService,
        private language: GlobalLanguageService,
        private globalIntentService: GlobalIntentService,
        private globalNav: GlobalNavService,
        // In-app Services
        private walletInitService: WalletInitService,
        private crCouncilVotingInitService: CRCouncilVotingInitService,
        private contactsInitService: ContactsInitService,
        private walletNetworkService: WalletNetworkService
    ) { }

    public init() {
        this.intentSubscription = this.globalIntentService.intentListener.subscribe((receivedIntent) => {
            if (!receivedIntent)
                return;

            this.onIntentReceived(receivedIntent);
        });
    }

    public stop() {
        if (this.intentSubscription) {
            this.intentSubscription.unsubscribe();
            this.intentSubscription = null;
        }
    }

    private onIntentReceived(intent: EssentialsIntentPlugin.ReceivedIntent) {
        switch (this.getShortAction(intent.action)) {
            case "onboard":
                this.handleOnBoardIntent(intent);
                break;
            case "picklauncherwidget":
                this.handlePickWidgetIntent(intent);
                break;
            default:
                return;
        }
    }

    /**
     * From a full new-style action string such as https://essentials.web3essentials.io/app
     * returns the short old-style action "app" for convenience.
     */
    private getShortAction(fullAction: string): string {
        let shortAction = fullAction.replace("https://essentials.elastos.net/", ""); // backward compatibility
        shortAction = shortAction.replace("https://essentials.web3essentials.io/", ""); // new intent urls
        return shortAction;
    }

    private handleOnBoardIntent(intent: EssentialsIntentPlugin.ReceivedIntent) {
        // The onboard intent's only feature (easybridge) was removed, so all callers
        // get answered without navigating anywhere. The intent still brings Essentials
        // to the foreground, so tell the user why nothing else happens.
        this.native.genericToast("launcher.onboard-feature-unavailable", 2000);
        void this.globalIntentService.sendIntentResponse({ error: "Unsupported feature" }, intent.intentId, false);
    }

    private handlePickWidgetIntent(intent: EssentialsIntentPlugin.ReceivedIntent) {
        void this.globalNav.navigateTo(App.LAUNCHER, "/intents/picklauncherwidget", {
            state: {
                intent
            }
        });
    }
}