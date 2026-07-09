/**
 * Canonical, dependency-free helpers for reasoning about the trust of a URL/endpoint.
 *
 * These are pure, synchronous functions with no Angular dependencies, so they are safe to
 * call from anywhere (settings validation, dApp-browser checks, custom-RPC entry) and are
 * unit-testable in isolation. They are the single place to grow URL-trust logic; today they
 * replace ad-hoc origin parsing scattered across url.helpers.ts and the dApp browser.
 *
 * IMPORTANT: isPrivateHost() is a literal-IP/hostname heuristic only. It does NOT resolve DNS,
 * so a public hostname that resolves to a private address is NOT caught here. Do not treat this
 * module as full SSRF protection.
 */

/** Where an endpoint's trust originates. */
export const TrustLevel = {
  /** Shipped in the app build (environment config). */
  BUILD_TIME: 'build-time',
  /** Delivered by a signed remote config bundle. */
  SIGNED_CONFIG: 'signed-config',
  /** Added by the user (custom RPC, custom network). */
  USER_ADDED: 'user-added',
  /** Provided by a dApp at runtime. */
  DAPP_PROVIDED: 'dapp-provided'
} as const;

export type TrustLevel = typeof TrustLevel[keyof typeof TrustLevel];

/** A URL/endpoint annotated with where its trust comes from and what it is used for. */
export interface TrustedEndpoint {
  url: string;
  trustLevel: TrustLevel;
  origin: string;
  purpose: string;
}

// Matches literal IPv4 addresses in the private/loopback/link-local ranges. Hostnames that
// resolve to these via DNS are intentionally NOT covered (no lookup is performed).
const PRIVATE_IPV4 = /^(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Returns the scheme + host (origin) of a URL, or null when the input is not a parseable URL.
 * This is the canonical replacement for the ad-hoc origin parsers elsewhere in the app.
 */
export function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** True when the URL uses the https scheme. */
export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** True when the URL uses one of the allowed schemes (defaults to https/wss). */
export function isKnownScheme(url: string, allowed: string[] = ['https:', 'wss:']): boolean {
  try {
    return allowed.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** True when the URL points at the local machine (loopback or a .local mDNS name). */
export function isLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return LOCAL_HOSTNAMES.has(host) || host.endsWith('.local');
  } catch {
    return false;
  }
}

/**
 * True when the URL's host is a literal private/loopback/link-local address, or a local
 * hostname. Heuristic only: no DNS resolution is performed, so a public hostname that resolves
 * to a private IP is not detected.
 */
export function isPrivateHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    if (LOCAL_HOSTNAMES.has(host) || host.endsWith('.local')) return true;
    if (PRIVATE_IPV4.test(host)) return true;
    // Unique-local IPv6 (fc00::/7 -> addresses starting fc or fd).
    if (/^\[?f[cd][0-9a-f]{2}:/i.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * True when the URL's origin matches one of the allowlist entries (compared by origin, so path
 * and query are ignored and the port is significant). Malformed inputs never match.
 */
export function matchesAllowlist(url: string, allowlist: string[]): boolean {
  const origin = safeOrigin(url);
  if (!origin) return false;
  return allowlist.some(entry => {
    const allowedOrigin = safeOrigin(entry);
    return allowedOrigin !== null && allowedOrigin === origin;
  });
}
