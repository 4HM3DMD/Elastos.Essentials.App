import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from 'src/app/components/sharedcomponents.module';
import { UiComponentsModule } from 'src/app/components/ui/ui-components.module';
import { AddProfilePage } from './add-profile.page';

@NgModule({
  declarations: [AddProfilePage],
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule,
    SharedComponentsModule,
    UiComponentsModule,
    RouterModule.forChild([{ path: '', component: AddProfilePage }])
  ]
})
export class AddProfilePageModule {}
