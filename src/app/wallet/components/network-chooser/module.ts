import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from 'src/app/components/sharedcomponents.module';
import { UiComponentsModule } from 'src/app/components/ui/ui-components.module';
import { NetworkChooserComponent } from './network-chooser.component';

@NgModule({
  declarations: [
    NetworkChooserComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    TranslateModule,
    SharedComponentsModule,
    UiComponentsModule
  ],
  exports: [
    NetworkChooserComponent
  ],
  providers: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class NetworkChooserComponentModule { }
