import { Component, ViewChild } from '@angular/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { App } from 'src/app/model/app.enum';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { CRCouncilVotingInitService } from 'src/app/voting/crcouncilvoting/services/init.service';
import { DPoS2InitService } from 'src/app/voting/dpos2/services/init.service';
import { VoteService } from 'src/app/voting/services/vote.service';
import { StakingInitService } from 'src/app/voting/staking/services/init.service';

/**
 * The Elastos hub: the landing page of the tab bar's center button. Groups the
 * Elastos main chain features (staking, BPoS voting, network statistics) and the
 * Elastos DAO features (identity, proposals, council) as two card sections.
 */
@Component({
  selector: 'app-elastos-hub',
  templateUrl: './elastos-hub.page.html',
  styleUrls: ['./elastos-hub.page.scss']
})
export class ElastosHubPage {
  @ViewChild(TitleBarComponent, { static: true }) titleBar: TitleBarComponent;

  // Prevents double-launching while a destination (and its possible
  // network-switch / wallet prompts) is starting.
  private launching = false;

  constructor(
    public theme: GlobalThemeService,
    private globalNav: GlobalNavService,
    private stakingInitService: StakingInitService,
    private dpos2InitService: DPoS2InitService,
    private crCouncilVotingInitService: CRCouncilVotingInitService,
    private voteService: VoteService
  ) {}

  ionViewWillEnter() {
    this.titleBar.setTitle('Elastos');
  }

  private async launch(action: () => Promise<unknown>): Promise<void> {
    if (this.launching) return;
    this.launching = true;
    try {
      await action();
    } finally {
      this.launching = false;
    }
  }

  public onStaking(): void {
    void this.launch(() => this.stakingInitService.start());
  }

  public onVoting(): void {
    void this.launch(() => this.dpos2InitService.start());
  }

  public onStatistics(): void {
    void this.launch(() => this.voteService.selectWalletAndNavTo(App.DPOS2, '/dpos2/menu/stats'));
  }

  public onIdentity(): void {
    void this.launch(() => this.globalNav.navigateTo(App.IDENTITY, '/identity/myprofile/home'));
  }

  public onProposals(): void {
    void this.launch(() => this.globalNav.navigateTo(App.CRPROPOSAL_VOTING, '/crproposalvoting/proposals/all'));
  }

  public onCouncil(): void {
    void this.launch(() => this.crCouncilVotingInitService.startCouncil());
  }
}
