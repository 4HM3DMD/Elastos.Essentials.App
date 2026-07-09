import { Component, Input } from '@angular/core';

/**
 * The requesting origin shown at the top of a signing / transaction sheet.
 * `host` is the eTLD+1-emphasised site (or an external app id); `secure`
 * distinguishes https from http; `verified` is the WalletConnect verify state.
 */
export interface RequestOrigin {
  host: string;
  secure?: boolean;
  verified?: 'verified' | 'unverified';
  label?: string;
}

/**
 * DB-3.1: a compact "which site is asking" banner rendered at the top of every
 * signing / transaction sheet. It is the primary anti-phishing surface - the
 * user must always be able to see the requesting origin, whether the connection
 * is secure, and (for WalletConnect) whether the peer is verified. Presentational
 * only, theme-token driven. The fixed chrome labels are English pending i18n
 * (localization is a tracked follow-up across all new strings).
 */
@Component({
  selector: 'ui-origin-header',
  templateUrl: './ui-origin-header.component.html',
  styleUrls: ['./ui-origin-header.component.scss']
})
export class UiOriginHeaderComponent {
  @Input() public origin: RequestOrigin = null;
}

/**
 * Builds a RequestOrigin from a raw dApp origin URL (as stamped onto the intent
 * by the dApp-browser / WalletConnect protocol services). Returns null when no
 * origin is available (e.g. an external-app intent), so the sheet simply renders
 * no banner rather than a misleading one.
 */
export function parseRequestOrigin(
  dappOrigin: string | null | undefined,
  opts?: { verified?: 'verified' | 'unverified'; label?: string }
): RequestOrigin | null {
  if (!dappOrigin) {
    return null;
  }
  let host = dappOrigin;
  let secure: boolean | undefined;
  try {
    const parsed = new URL(dappOrigin);
    host = parsed.host || dappOrigin;
    secure = parsed.protocol === 'https:';
  } catch {
    // Not a parseable URL: display the raw value and leave the secure state unknown.
  }
  return { host, secure, verified: opts?.verified, label: opts?.label };
}
