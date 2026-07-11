import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { NetworkChooserComponentModule } from 'src/app/wallet/components/network-chooser/module';
import { ProfileSelectorComponentModule } from 'src/app/components/profile-selector/module';
import { SharedComponentsModule } from '../../../components/sharedcomponents.module';
import { UiComponentsModule } from 'src/app/components/ui/ui-components.module';
import { GlobalDirectivesModule } from '../../../helpers/directives/module';
import { OptionsComponentsModule } from '../../components/options/module';
import { WalletAddressChooserComponentsModule } from '../../components/wallet-address-chooser/module';
import { NewsConfiguratorComponentsModule } from '../../widgets/builtin/news/components/configurator/module';
import { WidgetModule } from '../../widgets/module';
import { HomePage } from './home.page';

@NgModule({
  declarations: [
    HomePage
  ],
  imports: [
    CommonModule,
    IonicModule,
    HttpClientModule,
    SharedComponentsModule,
    UiComponentsModule,
    TranslateModule,
    GlobalDirectivesModule,
    WalletAddressChooserComponentsModule,
    OptionsComponentsModule,
    NetworkChooserComponentModule,
    ProfileSelectorComponentModule,
    NewsConfiguratorComponentsModule,
    WidgetModule,
    RouterModule.forChild([{ path: '', component: HomePage }])
  ],
  providers: [],
  bootstrap: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomePageModule { }
