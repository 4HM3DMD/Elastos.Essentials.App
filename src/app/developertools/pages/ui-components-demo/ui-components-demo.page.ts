import { Component, ViewChild } from '@angular/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { TitleBarNavigationMode } from 'src/app/components/titlebar/titlebar.types';
import { UiChip } from 'src/app/components/ui/ui-chip-row/ui-chip-row.component';

/**
 * Developer-only harness that renders every UI primitive in every state, over a
 * stress dataset (long values, missing fields, skeletons). Used to review the
 * components in isolation. Removed with the demo cleanup in a later work order.
 */
@Component({
  selector: 'page-ui-components-demo',
  templateUrl: './ui-components-demo.page.html',
  styleUrls: ['./ui-components-demo.page.scss']
})
export class UiComponentsDemoPage {
  @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

  public readonly icon = '/assets/launcher/apps/app-icons/dpos.svg';
  public readonly badge = '/assets/launcher/apps/app-icons/browser.svg';

  public hiddenAmount = false;
  public activeChip = 'all';
  public readonly chips: UiChip[] = [
    { key: 'all', label: 'All' },
    { key: 'money', label: 'Money' },
    { key: 'identity', label: 'Identity', badge: '3' },
    { key: 'apps', label: 'Apps' },
    { key: 'governance', label: 'Governance' }
  ];

  public ionViewWillEnter(): void {
    this.titleBar.setTitle('UI Components');
    this.titleBar.setNavigationMode(TitleBarNavigationMode.BACK);
  }

  public onToggleHidden(): void {
    this.hiddenAmount = !this.hiddenAmount;
  }

  public onChipChange(key: string): void {
    this.activeChip = key;
  }

  public noop(): void {
    /* demo action */
  }
}
