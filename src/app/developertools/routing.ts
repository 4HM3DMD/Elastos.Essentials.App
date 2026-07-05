import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { HomePage } from './pages/home/home';
import { CreateAppPage } from './pages/createapp/createapp';
import { AppDetailsPage } from './pages/appdetails/appdetails';
import { UiComponentsDemoPage } from './pages/ui-components-demo/ui-components-demo.page';

const routes: Routes = [
  { path: 'home', component: HomePage },
  { path: 'createapp', component: CreateAppPage },
  { path: 'appdetails', component: AppDetailsPage },
  { path: 'ui-components-demo', component: UiComponentsDemoPage }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class DeveloperToolsRoutingModule {}
