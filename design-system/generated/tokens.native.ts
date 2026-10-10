// Gerado de tokens/source.json. Edite a fonte e execute pnpm tokens:build.
export const tokens = {
  "brand": {
    "blue": "#2447e8",
    "lilac": "#d8b3eb",
    "white": "#ffffff",
    "sun": "#ffd86a",
    "ink": "#17264d"
  },
  "color": {
    "light": {
      "bg": "#f7f9ff",
      "surface": "#ffffff",
      "surface-raised": "#e8efff",
      "surface-accent": "#f4e9f8",
      "text": "#17264d",
      "text-muted": "#4d5d82",
      "primary": "#2447e8",
      "on-primary": "#ffffff",
      "accent": "#d8b3eb",
      "on-accent": "#17264d",
      "border": "#6a7ca6",
      "border-soft": "#c9d4eb",
      "focus": "#1f3daa",
      "success-bg": "#e8f7ee",
      "success-text": "#17653d",
      "warning-bg": "#fff1c7",
      "warning-text": "#774700",
      "danger-bg": "#ffe8ee",
      "danger-text": "#a12644",
      "shadow": "#17264d"
    },
    "dark": {
      "bg": "#0b1530",
      "surface": "#162445",
      "surface-raised": "#21345a",
      "surface-accent": "#3a2c4d",
      "text": "#f7f8ff",
      "text-muted": "#cbd5ef",
      "primary": "#8ba8ff",
      "on-primary": "#101a38",
      "accent": "#e0b9f0",
      "on-accent": "#22132e",
      "border": "#8ea2cc",
      "border-soft": "#4d5e82",
      "focus": "#e0b9f0",
      "success-bg": "#183c30",
      "success-text": "#8ceab8",
      "warning-bg": "#4a321a",
      "warning-text": "#ffda89",
      "danger-bg": "#4d2632",
      "danger-text": "#ffb4c1",
      "shadow": "#050a19"
    }
  },
  "type": {
    "xs": 12,
    "sm": 14,
    "body": 16,
    "lead": 20
  },
  "space": {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "6": 24,
    "8": 32,
    "12": 48,
    "16": 64
  },
  "radius": {
    "control": 14,
    "card": 22,
    "pill": 999
  },
  "motion": {
    "fast": 140,
    "base": 240,
    "emphasis": 420
  },
  "stroke": 2
} as const;

export type Theme = keyof typeof tokens.color;
