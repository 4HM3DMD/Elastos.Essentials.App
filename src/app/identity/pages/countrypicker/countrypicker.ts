import { Component, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { Logger } from 'src/app/logger';
import { GlobalEvents } from 'src/app/services/global.events.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { area } from '../../../../assets/identity/area/area';
import { CountryCodeInfo } from '../../model/countrycodeinfo';
import { Native } from '../../services/native';

@Component({
  selector: 'page-countrypicker',
  templateUrl: 'countrypicker.html',
  styleUrls: ['countrypicker.scss']
})
export class CountryPickerPage {
  @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;

  // allAreas is the full supported list (source of truth); areaList is the currently
  // displayed subset after the search filter.
  allAreas: CountryCodeInfo[] = [];
  areaList: CountryCodeInfo[] = [];
  areaItem: any = null;
  searchTerm = '';

  constructor(
    public events: GlobalEvents,
    private translate: TranslateService,
    public theme: GlobalThemeService,
    private native: Native
  ) {
    // Filter out united stated from the list, we are not allwoed to support users in that country.
    this.allAreas = area.filter(a => !["USA", "UMI"].includes(a.alpha3));
    this.areaList = this.allAreas;

    Logger.log('Identity', 'areaList', this.areaList);
  }

  // Filters the displayed country list by name or alpha-3 code as the user types.
  handleSearch() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.areaList = this.allAreas;
      return;
    }
    this.areaList = this.allAreas.filter(
      a => a.name.toLowerCase().includes(term) || a.alpha3.toLowerCase().includes(term)
    );
  }

  ionViewWillEnter() {
    this.titleBar.setTitle(this.translate.instant('common.country'));
  }

  ionViewWillLeave() {
  }

  selectItem(item) {
    this.events.publish('selectarea', item);
    this.native.pop();
  }
}
