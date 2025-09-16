export const gradientPalette = {
  // Pink gradient: #FDCBF1 to #FFE1E1
  pink: {
    50: "#fef7f7", // Lightest pink
    100: "#ffe1e1", // Light end of gradient
    200: "#fed7d7", // Soft pink
    300: "#fdcbf1", // Pink start of gradient
    400: "#f8a5d8", // Medium pink
    500: "#f472b6", // Pink base
    600: "#ec4899", // Deeper pink
    700: "#db2777", // Rich pink
    800: "#be185d", // Dark pink
    900: "#9f1239", // Deep pink
  },

  // Peach gradient: #FDE0DD to #ECE1F0
  peach: {
    50: "#fefcfc", // Lightest peach
    100: "#ece1f0", // Light end of gradient
    200: "#f0e6e6", // Soft peach
    300: "#fde0dd", // Peach start of gradient
    400: "#f9c5c0", // Medium peach
    500: "#f59e95", // Peach base
    600: "#f07167", // Deeper peach
    700: "#e85d75", // Rich peach
    800: "#d63384", // Dark peach
    900: "#b02a5b", // Deep peach
  },

  // Purple gradient: #D1CCFF to #FFB7B9
  purple: {
    50: "#faf9ff", // Lightest purple
    100: "#ffb7b9", // Light end of gradient
    200: "#f0ccff", // Soft purple
    300: "#d1ccff", // Purple start of gradient
    400: "#c4b5fd", // Medium purple
    500: "#a78bfa", // Purple base
    600: "#8b5cf6", // Deeper purple
    700: "#7c3aed", // Rich purple
    800: "#6d28d9", // Dark purple
    900: "#581c87", // Deep purple
  },

  // Blue gradient: #C2E9FB to #E0D1F7
  blue: {
    50: "#f0f9ff", // Lightest blue
    100: "#e0d1f7", // Light end of gradient
    200: "#d1e7ff", // Soft blue
    300: "#c2e9fb", // Blue start of gradient
    400: "#7dd3fc", // Medium blue
    500: "#38bdf8", // Blue base
    600: "#0ea5e9", // Deeper blue
    700: "#0284c7", // Rich blue
    800: "#0369a1", // Dark blue
    900: "#0c4a6e", // Deep blue
  },

  // Neutral grays for text and backgrounds
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
  },
} as const

export const designTokens = {
  // Spacing scale (4/8px base)
  spacing: {
    xs: "0.25rem", // 4px
    sm: "0.5rem", // 8px
    md: "0.75rem", // 12px
    lg: "1rem", // 16px
    xl: "1.5rem", // 24px
    "2xl": "2rem", // 32px
    "3xl": "3rem", // 48px
    "4xl": "4rem", // 64px
    "5xl": "6rem", // 96px
  },

  // Border radius
  radius: {
    sm: "0.5rem", // 8px
    md: "0.875rem", // 14px
    lg: "1.5rem", // 24px
    pill: "9999px", // Full rounded
  },

  // Ultra-soft shadows
  shadows: {
    xs: "0 1px 20px rgba(0, 0, 0, 0.04)",
    sm: "0 2px 25px rgba(0, 0, 0, 0.06)",
    md: "0 4px 40px rgba(0, 0, 0, 0.08)",
    lg: "0 8px 60px rgba(0, 0, 0, 0.10)",
  },

  // Typography scale
  typography: {
    fontFamily: {
      sans: ["Inter", "system-ui", "sans-serif"],
      display: ["Outfit", "system-ui", "sans-serif"],
    },

    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
    },

    fontWeight: {
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
} as const

// Theme configuration
export const themeConfig = {
  light: {
    // Background with soft gradient feel
    background: "linear-gradient(135deg, #fef7f7 0%, #f0f9ff 100%)",
    surface: gradientPalette.neutral[50],
    surfaceElevated: "#ffffff",

    // Text colors
    textPrimary: gradientPalette.neutral[900],
    textSecondary: gradientPalette.neutral[700],
    textTertiary: gradientPalette.neutral[500],

    // Brand colors using the new palette
    primary: gradientPalette.purple[600],
    primaryHover: gradientPalette.purple[700],
    secondary: gradientPalette.pink[500],
    accent: gradientPalette.blue[500],

    // UI colors
    border: gradientPalette.neutral[200],
    borderSubtle: gradientPalette.neutral[100],

    // Chat specific colors
    userBubble: "linear-gradient(135deg, #d1ccff 0%, #ffb7b9 100%)",
    assistantBubble: gradientPalette.neutral[50],
    composerBackground: gradientPalette.neutral[50],
  },

  dark: {
    background: "linear-gradient(135deg, #171717 0%, #262626 100%)",
    surface: gradientPalette.neutral[800],
    surfaceElevated: gradientPalette.neutral[700],

    textPrimary: gradientPalette.neutral[50],
    textSecondary: gradientPalette.neutral[300],
    textTertiary: gradientPalette.neutral[400],

    primary: gradientPalette.purple[400],
    primaryHover: gradientPalette.purple[300],
    secondary: gradientPalette.pink[400],
    accent: gradientPalette.blue[400],

    border: gradientPalette.neutral[700],
    borderSubtle: gradientPalette.neutral[800],

    userBubble: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
    assistantBubble: gradientPalette.neutral[800],
    composerBackground: gradientPalette.neutral[800],
  },
} as const

export type ThemeMode = keyof typeof themeConfig
