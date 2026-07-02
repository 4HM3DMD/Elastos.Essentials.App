import { ThemeConfig } from "./theme";

export const availableThemes: ThemeConfig[] = [
  {
    key: "white",
    variants: {
      "light": { color: "#F4F4F6", boxColor: "#FFFFFF", textColor: "#111114", buttonBackgroundColor: "#F6921A", buttonTextColor: "#1A1208" },
      "dark": { color: "#FFFFFF", boxColor: "#F4F4F6", textColor: "#111114", buttonBackgroundColor: "#F6921A", buttonTextColor: "#1A1208" }
    },
    usesDarkMode: false
  },
  {
    key: "black",
    variants: {
      "light": { color: "#0B0B0D", boxColor: "#161619", textColor: "#F5F5F7", buttonBackgroundColor: "#F6921A", buttonTextColor: "#1A1208" },
      "dark": { color: "#161619", boxColor: "#0B0B0D", textColor: "#F5F5F7", buttonBackgroundColor: "#F6921A", buttonTextColor: "#1A1208" }
    },
    usesDarkMode: true
  },
  {
    key: "blue",
    variants: {
      "light": { color: "#172F4C", boxColor: "#395980" },
      "dark": { color: "#395980", boxColor: "#172F4C" }
    },
    usesDarkMode: true
  },
  {
    key: "red",
    variants: {
      "light": { color: "#4C1717", boxColor: "#802727" },
      "dark": { color: "#802727", boxColor: "#4C1717" }
    },
    usesDarkMode: true
  },
  {
    key: "purple",
    variants: {
      "light": { color: "#30224C", boxColor: "#533991" },
      "dark": { color: "#533991", boxColor: "#30224C" }
    },
    usesDarkMode: true
  },
  // Really too ugly...
  /* {
    key: "yellow",
    variants: {
      "light": { color: "#BF9C3B", boxColor: "#F2C64B", buttonBackgroundColor: "#000000" },
      "dark": { color: "#F2C64B", boxColor: "#BF9C3B", buttonBackgroundColor: "#000000" }
    },
    usesDarkMode: true
  }, */
  {
    key: "orange",
    variants: {
      "light": { color: "#BF733B", boxColor: "#F2914B" },
      "dark": { color: "#F2914B", boxColor: "#BF733B" }
    },
    usesDarkMode: true
  },
  {
    key: "green",
    variants: {
      "light": { color: "#224C33", boxColor: "#398055" },
      "dark": { color: "#398055", boxColor: "#224D33" }
    },
    usesDarkMode: true
  },
  {
    key: "pink",
    variants: {
      "light": { color: "#B05CB2", boxColor: "#E376E5", buttonBackgroundColor: "#000000", buttonTextColor: "#ffffff" },
      "dark": { color: "#E376E5", boxColor: "#B05CB2" }
    },
    usesDarkMode: true
  },
];