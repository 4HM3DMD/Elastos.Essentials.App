import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonInput } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { TitleBarComponent } from 'src/app/components/titlebar/titlebar.component';
import { UiChip } from 'src/app/components/ui/ui-chip-row/ui-chip-row.component';
import { BuiltInIcon, TitleBarIcon, TitleBarIconSlot, TitleBarMenuItem } from 'src/app/components/titlebar/titlebar.types';
import { Logger } from 'src/app/logger';
import { App } from 'src/app/model/app.enum';
import { GlobalFirebaseService } from 'src/app/services/global.firebase.service';
import { GlobalNavService } from 'src/app/services/global.nav.service';
import { GlobalPopupService } from 'src/app/services/global.popup.service';
import { GlobalThemeService } from 'src/app/services/theming/global.theme.service';
import { UXService } from '../../../services/ux.service';
import { SuggestionSearchResult, SuggestionStatus } from '../../model/suggestion-model';
import { SuggestionService } from '../../services/suggestion.service';

@Component({
    selector: 'page-suggestion-list',
    templateUrl: 'suggestion-list.html',
    styleUrls: ['./suggestion-list.scss']
})
export class SuggestionListPage implements OnInit {
    @ViewChild(TitleBarComponent, { static: false }) titleBar: TitleBarComponent;
    @ViewChild('content', { static: false }) content: IonContent;
    @ViewChild('search', { static: false }) search: IonInput;

    public suggestionStatus: SuggestionStatus;
    public suggestions: SuggestionSearchResult[] = [];
    public suggestionsFetched = false;

    // Proposals and suggestions form one combined screen; these chips switch between them.
    public segments: UiChip[] = [];
    public activeSegment = 'suggestions';

    public showSearch = false;
    public searchInput = '';

    private fetchPage = 1;
    private searchPage = 1;

    private titleBarIconClickedListener: (icon: TitleBarIcon | TitleBarMenuItem) => void;

    constructor(
        public uxService: UXService,
        public theme: GlobalThemeService,
        private suggestionService: SuggestionService,
        private route: ActivatedRoute,
        private globalNav: GlobalNavService,
        public translate: TranslateService,
        private globalPopupService: GlobalPopupService,
    ) {
        this.suggestionStatus = this.route.snapshot.params.suggestionType as SuggestionStatus;
        Logger.log(App.CRSUGGESTION, 'Suggestion status:', this.suggestionStatus);

        GlobalFirebaseService.instance.logEvent("voting_suggestions_list_enter");
    }

    ngOnInit() {
    }

    ionViewDidEnter() {
    }

    ionViewWillEnter() {
        void this.init();
    }

    ionViewWillLeave() {
        this.titleBar.removeOnItemClickedListener(this.titleBarIconClickedListener);
    }

    async init() {
        this.titleBar.setTitle(this.translate.instant('crproposalvoting.suggestions'));
        this.segments = [
            { key: 'proposals', label: this.translate.instant('crproposalvoting.proposals') },
            { key: 'suggestions', label: this.translate.instant('crproposalvoting.suggestions') }
        ];
        this.titleBar.setIcon(TitleBarIconSlot.OUTER_RIGHT, { key: "scan", iconPath: BuiltInIcon.SCAN });
        this.titleBar.addOnItemClickedListener(this.titleBarIconClickedListener = (icon) => {
            void this.globalNav.navigateTo("scanner", '/scanner/scan');
        });

        //Don't refreash the list.
        if (this.suggestionsFetched) {
            return;
        }

        this.suggestionService.reset();
        await this.fetchSuggestions();
    }

    async fetchSuggestions(results = 10) {
        try {
            this.suggestions = await this.suggestionService.fetchSuggestions(this.suggestionStatus, 1, results);
            this.suggestionsFetched = true;
            this.showSearch = true;
            this.fetchPage = Math.floor(this.suggestions.length / 10) + 1;
            Logger.log(App.CRSUGGESTION, 'fetchSuggestions', this.suggestions);
        }
        catch (err) {
            Logger.error(App.CRSUGGESTION, 'fetchSuggestions error:', err)
        }
    }

    async searchSuggestion(event) {
        Logger.log(App.CRSUGGESTION, 'Search input changed', event);
        // Reset Search Page #
        this.searchPage = 1;
        if (this.searchInput) {
            this.suggestionsFetched = false;
            this.titleBar.setTitle(this.translate.instant('crproposalvoting.searching-suggestions'));
            try {
                this.suggestions = await this.suggestionService.fetchSearchedSuggestion(1, this.suggestionStatus, this.searchInput);
                this.suggestionsFetched = true;
                this.titleBar.setTitle(this.translate.instant('crproposalvoting.suggestions'));
                this.searchPage = 2;
            }
            catch (err) {
                Logger.error(App.CRSUGGESTION, 'searchSuggestion error:', err);
                this.titleBar.setTitle(this.translate.instant('crproposalvoting.suggestions'));
            }
        } else {
            this.suggestions = this.suggestionService.allResults;
        }
    }

    async doRefresh(event) {
        this.searchInput = '';
        this.suggestionService.reset();
        await this.fetchSuggestions(this.suggestionService.allResults.length);

        setTimeout(() => {
            event.target.complete();
        }, 500);
    }

    public async loadMoreSuggestions(event) {
        Logger.log(App.CRSUGGESTION, 'Loading more suggestions', this.fetchPage);
        void this.content.scrollToBottom(300);

        let suggestionsLength = this.suggestions.length;

        try {
            if (this.searchInput) {
                this.suggestions = await this.suggestionService.fetchSearchedSuggestion(this.searchPage, this.suggestionStatus, this.searchInput);
            }
            else {
                this.suggestions = await this.suggestionService.fetchSuggestions(this.suggestionStatus, this.fetchPage);
            }
        }
        catch (err) {
            Logger.error(App.CRSUGGESTION, 'loadMoreSuggestions error:', err);
        }

        if (this.suggestions.length === suggestionsLength) {
            void this.uxService.genericToast(this.translate.instant('crproposalvoting.all-suggestions-are-loaded'));
        }
        else {
            if (this.searchInput) {
                this.searchPage++;
            } else {
                this.fetchPage++;
            }
            void this.content.scrollToBottom(300);
        }

        event.target.complete();
    }

    public onSegmentChange(key: string) {
        if (key !== 'proposals') {
            return;
        }
        // This page instance stays alive in Ionic's stack; drop any search filter
        // so returning to the segment shows the full list again.
        if (this.searchInput) {
            this.searchInput = '';
            this.suggestions = this.suggestionService.allResults;
        }
        // Drop both list routes from the history so back from the combined screen
        // returns to whatever opened it instead of ping-ponging between segments.
        this.globalNav.clearIntermediateRoutes(['/crproposalvoting/proposals/all', '/crproposalvoting/suggestions/all']);
        void this.globalNav.navigateTo(App.CRPROPOSAL_VOTING, '/crproposalvoting/proposals/all', { animated: false });
    }

    selectSuggestion(suggestion: SuggestionSearchResult) {
        // suggestion = this.suggestionService.getFetchedSuggestionById(754);
        Logger.log(App.CRSUGGESTION, 'selectSuggestion:', suggestion);
        // this.suggestionService.selectedSuggestion = suggestion;
        void this.globalNav.navigateTo(App.CRSUGGESTION, "/crproposalvoting/suggestion-detail", { state: { suggestionId: suggestion.sid } });
    }
}
