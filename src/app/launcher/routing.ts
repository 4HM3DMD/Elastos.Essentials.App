import { Component, NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OnboardPage } from './pages/onboard/onboard.page';

@Component({ template: "<div>Launcher default route</div>" })
export class EmptyPage { }

const routes: Routes = [
  { path: 'onboard', component: OnboardPage },
  { path: 'home', loadChildren: () => import("./pages/home/module").then(m => m.HomePageModule) },
  { path: 'elastos', loadChildren: () => import("./pages/elastos-hub/module").then(m => m.ElastosHubPageModule) },
  { path: 'addprofile', loadChildren: () => import("./pages/add-profile/module").then(m => m.AddProfilePageModule) },
  { path: 'intents/picklauncherwidget', loadChildren: () => import("./widgets/base/widget-chooser/module").then(m => m.WidgetChooserComponentModule) },
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class LauncherRoutingModule { }
