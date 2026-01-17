import { Platform } from "react-native";

const primaryLight = "#2563EB";
const primaryDark = "#3B82F6";
const primaryPink = "#EC4899";

export type ThemeMode = 'light' | 'dark' | 'pink';

export const Colors = {
  light: {
    text: "#111827",
    textSecondary: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: primaryLight,
    link: primaryLight,
    primary: primaryLight,
    accent: "#F97316",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F9FAFB",
    backgroundSecondary: "#F3F4F6",
    backgroundTertiary: "#E5E7EB",
    border: "#E5E7EB",
    cardBackground: "#FFFFFF",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: primaryDark,
    link: primaryDark,
    primary: primaryDark,
    accent: "#FB923C",
    success: "#34D399",
    warning: "#FBBF24",
    danger: "#F87171",
    backgroundRoot: "#111827",
    backgroundDefault: "#1F2937",
    backgroundSecondary: "#374151",
    backgroundTertiary: "#4B5563",
    border: "#374151",
    cardBackground: "#1F2937",
  },
  pink: {
    text: "#4A1942",
    textSecondary: "#7C5174",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9D7A97",
    tabIconSelected: primaryPink,
    link: primaryPink,
    primary: primaryPink,
    accent: "#F472B6",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    backgroundRoot: "#FDF2F8",
    backgroundDefault: "#FCE7F3",
    backgroundSecondary: "#FBCFE8",
    backgroundTertiary: "#F9A8D4",
    border: "#F9A8D4",
    cardBackground: "#FDF2F8",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
