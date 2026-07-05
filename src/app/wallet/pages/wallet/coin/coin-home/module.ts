import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { SharedComponentsModule } from 'src/app/components/sharedcomponents.module';
import { UiComponentsModule } from 'src/app/components/ui/ui-components.module';
import { GlobalDirectivesModule } from 'src/app/helpers/directives/module';
import { ComponentsModule } from 'src/app/wallet/components/components.module';
import { CoinHomePage } from './coin-home.page';

@NgModule({
    declarations: [CoinHomePage],
    imports: [
        SharedComponentsModule,
        UiComponentsModule,
        CommonModule,
        FormsModule,
        IonicModule,
        TranslateModule,
        ComponentsModule,
        GlobalDirectivesModule,
        InlineSVGModule,
        RouterModule.forChild([{ path: '', component: CoinHomePage }])
    ],
    exports: [RouterModule],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CoinHomeModule { }