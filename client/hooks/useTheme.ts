import { useThemeContext } from "@/context/ThemeContext";

export function useTheme() {
  const { theme, isDark, themeMode, setThemeMode } = useThemeContext();

  return {
    theme,
    isDark,
    themeMode,
    setThemeMode,
  };
}
