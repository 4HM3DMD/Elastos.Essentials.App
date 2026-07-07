import { ThemeConfig } from "./theme";
import { ACCENT, ACCENT_INK, TEXT_ON_DARK, TEXT_ON_LIGHT } from "./tokens";

/**
 * The two official themes (UI overhaul, doc 144 II.1).
 *
 * - "black" is the signed-in default: near-black background, dark surfaces, orange actions.
 * - "white" is the light counterpart sharing the same accent system.
 *
 * Background values are theme-specific by design; shared brand values come from tokens.ts.
 * The dark background #0B0B0D is mirrored by the BackgroundColor preference in config.xml
 * (native WebView underlay); update both together.
 *
 * Legacy novelty themes (blue/red/purple/orange/green/pink) were retired; users who had
 * one selected are migrated to the default by GlobalThemeService.fetchThemeFromPreferences().
 */
export const availableThemes: ThemeConfig[] = [
  {
    key: "black",
    variants: {
      // Both variants render the single 2026 dark design: #111111 page with #1E1E1E
      // raised surfaces (measured from Figma). The old #0B0B0D/#161619 pair sat only
      // ~11 luminance points apart, so cards never read as raised.
      "light": { color: "#111111", boxColor: "#1E1E1E", textColor: TEXT_ON_DARK, buttonBackgroundColor: ACCENT, buttonTextColor: ACCENT_INK },
      "dark": { color: "#111111", boxColor: "#1E1E1E", textColor: TEXT_ON_DARK, buttonBackgroundColor: ACCENT, buttonTextColor: ACCENT_INK }
    },
    usesDarkMode: true
  },
  {
    key: "white",
    variants: {
      "light": { color: "#F4F4F6", boxColor: "#FFFFFF", textColor: TEXT_ON_LIGHT, buttonBackgroundColor: ACCENT, buttonTextColor: ACCENT_INK },
      "dark": { color: "#FFFFFF", boxColor: "#F4F4F6", textColor: TEXT_ON_LIGHT, buttonBackgroundColor: ACCENT, buttonTextColor: ACCENT_INK }
    },
    usesDarkMode: false
  },
];
