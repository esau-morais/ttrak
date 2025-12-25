import type { CliRenderer } from "@opentui/core";
import { flavors } from "@catppuccin/palette";
import type { ThemeConfig } from "../schema";

export interface Theme {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  error: string;
  success: string;
  warning: string;
  border: string;
  selectedBg: string;
  selectedFg: string;
}

function luminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

async function detectDarkMode(renderer: CliRenderer): Promise<boolean> {
  try {
    const palette = await renderer.getPalette();
    const bg = (palette as any)?.defaultBackground;
    if (!bg) return true;
    return luminance(bg) < 0.5;
  } catch {
    return true;
  }
}

export async function getTheme(renderer: CliRenderer, config: ThemeConfig): Promise<Theme> {
  if (config.mode === "catppuccin") {
    const flavor = flavors[config.flavor];
    return {
      bg: flavor.colors.base.hex,
      fg: flavor.colors.text.hex,
      accent: flavor.colors.blue.hex,
      muted: flavor.colors.overlay0.hex,
      error: flavor.colors.red.hex,
      success: flavor.colors.green.hex,
      warning: flavor.colors.yellow.hex,
      border: flavor.colors.surface1.hex,
      selectedBg: flavor.colors.blue.hex,
      selectedFg: flavor.colors.base.hex,
    };
  }

  if (config.mode === "system") {
    const palette = await renderer.getPalette();
    const bg = (palette as any)?.defaultBackground || "#000000";
    const fg = (palette as any)?.defaultForeground || "#ffffff";
    return {
      bg,
      fg,
      accent: "#00aaff",
      muted: "#888888",
      error: "#ff5555",
      success: "#50fa7b",
      warning: "#ffb86c",
      border: "#44475a",
      selectedBg: "#00aaff",
      selectedFg: "#000000",
    };
  }

  const isDark = await detectDarkMode(renderer);
  const flavor = isDark ? flavors.mocha : flavors.latte;

  return {
    bg: flavor.colors.base.hex,
    fg: flavor.colors.text.hex,
    accent: flavor.colors.blue.hex,
    muted: flavor.colors.overlay0.hex,
    error: flavor.colors.red.hex,
    success: flavor.colors.green.hex,
    warning: flavor.colors.yellow.hex,
    border: flavor.colors.surface1.hex,
    selectedBg: flavor.colors.blue.hex,
    selectedFg: flavor.colors.base.hex,
  };
}
