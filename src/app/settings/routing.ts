import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutPage } from './pages/about/about.page';
import { AppLockPage } from './pages/applock/applock.page';
import { AutoLockPage } from './pages/autolock/autolock.page';
import { DeveloperPage } from './pages/developer/developer.page';
import { DevTestsPage } from './pages/devtests/devtests.page';
import { ElastosAPIProviderPage } from './pages/elastosapiprovider/elastosapiprovider.page';
import { LanguagePage } from './pages/language/language.page';
import { MenuPage } from './pages/menu/menu.page';
import { PrivacyPage } from './pages/privacy/privacy.page';
import { StartupScreenPage } from './pages/startupscreen/startupscreen.page';
import { WalletConnectConnectV2Page } from './pages/walletconnect/connectv2/connectv2.page';
import { WalletConnectPrepareToConnectPage } from './pages/walletconnect/preparetoconnect/preparetoconnect.page';
import { WalletConnectSessionsPage } from './pages/walletconnect/sessions/sessions.page';

const routes: Routes = [
  { path: 'menu', component: MenuPage },
  { path: 'language', component: LanguagePage },
  { path: 'about', component: AboutPage },
  { path: 'developer', component: DeveloperPage },
  { path: 'devtests', component: DevTestsPage },
  { path: 'walletconnect/sessions', component: WalletConnectSessionsPage },
  { path: 'walletconnect/preparetoconnect', component: WalletConnectPrepareToConnectPage },
  { path: 'walletconnect/connectv2', component: WalletConnectConnectV2Page },
  { path: 'privacy', component: PrivacyPage },
  { path: 'privacy/elastosapiprovider', component: ElastosAPIProviderPage },
  { path: 'startupscreen', component: StartupScreenPage },
  { path: 'applock', component: AppLockPage },
  { path: 'autolock', component: AutoLockPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SettingsRoutingModule { }

