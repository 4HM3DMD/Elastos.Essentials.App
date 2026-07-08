/**
 * Design token constants (doc 144 II.1). Single source of truth for the brand
 * palette values shared by themes.ts, GlobalThemeService and the titlebar.
 *
 * The WebView underlay color in config.xml (BackgroundColor preference) mirrors
 * BACKGROUND_ON_DARK below and must be updated together with it.
 */

// Brand accent (actions, active states) and the text color used on top of it.
// Burnt orange measured from the 2026 design (was the yellow-leaning #F6921A).
export const ACCENT = '#ED6E2B';
export const ACCENT_INK = '#1A1208';

// Primary text colors per surface darkness.
export const TEXT_ON_DARK = '#FFFFFF';
export const TEXT_ON_LIGHT = '#111114';

// Semantic status colors, tuned per theme darkness for contrast.
export const SUCCESS_ON_DARK = '#6DCD66';
export const SUCCESS_ON_LIGHT = '#178A4C';
export const DANGER_ON_DARK = '#FF5F4B';
export const DANGER_ON_LIGHT = '#DF3F44';

// Pillar identity colors for the launcher home rows (doc 144 WO-9 / mock M0).
export const PILLAR_IDENTITY = '#6C5CE7';
export const PILLAR_APPS = '#3D7BFF';

// Hex alpha suffixes appended to the main text color for dimmed text tiers.
export const ALPHA_SECONDARY_ON_DARK = 'A6'; // 65% — brighter secondary tier, per the design
export const ALPHA_SECONDARY_ON_LIGHT = '99'; // 60%
export const ALPHA_TERTIARY = '61'; // 38%

// Theme selection defaults.
export const DEFAULT_THEME_KEY = 'black'; // Signed-in default (dark-first, doc 144 D2)
// Signed-out (DID sessions / onboarding) now also uses the dark design, matching the
// 2026 onboarding frames. Screens that hardcoded light backgrounds are being migrated.
export const SIGNED_OUT_THEME_KEY = 'black';

// cssClass applied to every toast so declared.scss can theme them in one place.
export const STD_TOAST_CLASS = 'std-toast';
