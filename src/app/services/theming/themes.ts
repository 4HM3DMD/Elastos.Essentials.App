import { ThemeConfig } from "./theme";

/**
 * Design tokens for the two official themes (UI overhaul, doc 144 II.1).
 *
 * - "black" is the default: near-black background, dark surfaces, orange actions.
 * - "white" is the light counterpart sharing the same accent system.
 *
 * Legacy novelty themes (blue/red/purple/orange/green/pink) were retired; users who
 * had one selected are migrated to "black" by GlobalThemeService.fetchThemeFromPreferences().
 */
export const availableThemes: ThemeConfig[] = [
  {
    key: "black",
    variants: {
      "light": { color: "#0B0B0D", boxColor: "#161619", textColor: "#F5F5F7", buttonBackgroundColor: "#F6921A", buttonTextColor: "#1A1208" },
      "dark": { color: "#161619", boxColor: "#0B0B0D", textColor: "#F5F5F7", buttonBackgroundColor: "#F6921A", buttonTextColor: "#1A1208" }
    },
    usesDarkMode: true
  },
  {
    key: "white",
    variants: {
      "light": { color: "#F4F4F6", boxColor: "#FFFFFF", textColor: "#111114", buttonBackgroundColor: "#F6921A", buttonTextColor: "#1A1208" },
      "dark": { color: "#FFFFFF", boxColor: "#F4F4F6", textColor: "#111114", buttonBackgroundColor: "#F6921A", buttonTextColor: "#1A1208" }
    },
    usesDarkMode: false
  },
];
