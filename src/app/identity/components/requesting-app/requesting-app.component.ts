import { Component, Input, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Logger } from 'src/app/logger';
import { GlobalApplicationDidService } from 'src/app/services/global.applicationdid.service';
import { GlobalHiveService } from 'src/app/services/global.hive.service';

/**
 * Best-effort display of the application requesting an identity intent.
 *
 * SECURITY NOTE: the caller DID received in intent params is SELF-DECLARED by the
 * calling application (connectivity SDK setApplicationDID()) and is NOT authenticated.
 * This component resolves the claimed application DID on chain to display its published
 * name and icon, informatively only. When nothing can be resolved, an explicit
 * "Unknown application" label is shown instead of any caller-supplied text, which
 * would be spoofable.
 */
@Component({
  selector: 'requesting-app',
  templateUrl: './requesting-app.component.html',
  styleUrls: ['./requesting-app.component.scss']
})
export class RequestingAppComponent implements OnInit {
  @Input() caller: string = null; // Application DID claimed by the calling app - unverified
  @Input() showUnknownLabel = true; // Set false for intents Essentials also sends to itself (eg. signdigest)

  public requestingAppName: string = null;
  public requestingAppIconUrl: string = null; // Base64 data url displayable in an <img> element

  constructor(
    private sanitizer: DomSanitizer,
    private globalApplicationDidService: GlobalApplicationDidService,
    private globalHiveService: GlobalHiveService
  ) { }

  ngOnInit() {
    void this.fetchApplicationDidInfo(); // Don't wait, just show app info when ready, if ready
  }

  private async fetchApplicationDidInfo(): Promise<void> {
    if (!this.caller)
      return;

    let publishedAppInfo = await this.globalApplicationDidService.fetchPublishedAppInfo(this.caller);
    if (publishedAppInfo.didDocument) {
      Logger.log('identity', 'Published application info:', publishedAppInfo);
      this.requestingAppName = publishedAppInfo.name;
      void this.fetchAppIcon(publishedAppInfo.iconUrl);
    }
  }

  private async fetchAppIcon(hiveIconUrl: string): Promise<void> {
    if (!hiveIconUrl)
      return;

    try {
      this.requestingAppIconUrl = await this.globalHiveService.fetchHiveScriptPictureToDataUrl(hiveIconUrl);
    }
    catch (e) {
      Logger.error('identity', `Failed to fetch application icon at ${hiveIconUrl}`);
    }
  }

  public getDappIcon(): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.requestingAppIconUrl);
  }
}
