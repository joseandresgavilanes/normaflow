import type { Config } from "tailwindcss";

/**
 * Tailwind no define valores propios: consume los design tokens de
 * `src/styles/tokens.css`.
 *
 * Antes este fichero declaraba una segunda identidad de marca (#123C66 marino
 * / #2E8B57 verde) que convivía con la de `globals.css` (#5266F6 índigo). No
 * había ninguna utilidad de color de Tailwind en uso, así que el conflicto era
 * latente: la primera vez que alguien escribiera `bg-primary` habría pintado
 * la marca equivocada.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--nf-background)",
        surface: {
          DEFAULT: "var(--nf-surface)",
          muted: "var(--nf-surface-muted)",
          sunken: "var(--nf-surface-sunken)",
          hover: "var(--nf-surface-hover)",
          selected: "var(--nf-surface-selected)",
        },
        border: {
          DEFAULT: "var(--nf-border)",
          subtle: "var(--nf-border-subtle)",
          strong: "var(--nf-border-strong)",
        },
        content: {
          DEFAULT: "var(--nf-text-primary)",
          secondary: "var(--nf-text-secondary)",
          muted: "var(--nf-text-muted)",
          subtle: "var(--nf-text-subtle)",
          link: "var(--nf-text-link)",
          inverse: "var(--nf-text-on-primary)",
        },
        primary: {
          DEFAULT: "var(--nf-primary)",
          hover: "var(--nf-primary-hover)",
          active: "var(--nf-primary-active)",
          subtle: "var(--nf-primary-subtle)",
          border: "var(--nf-primary-border)",
          foreground: "var(--nf-on-primary)",
        },
        success: {
          DEFAULT: "var(--nf-success)",
          text: "var(--nf-success-text)",
          subtle: "var(--nf-success-subtle)",
          border: "var(--nf-success-border)",
        },
        warning: {
          DEFAULT: "var(--nf-warning)",
          text: "var(--nf-warning-text)",
          subtle: "var(--nf-warning-subtle)",
          border: "var(--nf-warning-border)",
        },
        danger: {
          DEFAULT: "var(--nf-danger)",
          text: "var(--nf-danger-text)",
          subtle: "var(--nf-danger-subtle)",
          border: "var(--nf-danger-border)",
        },
        info: {
          DEFAULT: "var(--nf-info)",
          text: "var(--nf-info-text)",
          subtle: "var(--nf-info-subtle)",
          border: "var(--nf-info-border)",
        },
        disabled: {
          DEFAULT: "var(--nf-disabled-bg)",
          border: "var(--nf-disabled-border)",
          foreground: "var(--nf-disabled-text)",
        },
      },
      fontFamily: {
        sans: ["var(--nf-font-sans)"],
        display: ["var(--nf-font-display)"],
        heading: ["var(--nf-font-display)"],
        mono: ["var(--nf-font-mono)"],
      },
      fontSize: {
        "2xs": ["var(--nf-text-2xs)", { lineHeight: "var(--nf-leading-normal)" }],
        xs: ["var(--nf-text-xs)", { lineHeight: "var(--nf-leading-normal)" }],
        sm: ["var(--nf-text-sm)", { lineHeight: "var(--nf-leading-normal)" }],
        base: ["var(--nf-text-base)", { lineHeight: "var(--nf-leading-normal)" }],
        md: ["var(--nf-text-md)", { lineHeight: "var(--nf-leading-relaxed)" }],
        lg: ["var(--nf-text-lg)", { lineHeight: "var(--nf-leading-snug)" }],
        xl: ["var(--nf-text-xl)", { lineHeight: "var(--nf-leading-snug)" }],
        "2xl": ["var(--nf-text-2xl)", { lineHeight: "var(--nf-leading-tight)" }],
        "3xl": ["var(--nf-text-3xl)", { lineHeight: "var(--nf-leading-tight)" }],
      },
      borderRadius: {
        xs: "var(--nf-radius-xs)",
        sm: "var(--nf-radius-s)",
        DEFAULT: "var(--nf-radius-m)",
        md: "var(--nf-radius-m)",
        lg: "var(--nf-radius-l)",
        xl: "var(--nf-radius-l)",
        full: "var(--nf-radius-full)",
      },
      boxShadow: {
        sm: "var(--nf-elevation-1)",
        DEFAULT: "var(--nf-elevation-2)",
        card: "var(--nf-elevation-1)",
        dropdown: "var(--nf-elevation-3)",
        modal: "var(--nf-elevation-4)",
      },
      zIndex: {
        sticky: "var(--nf-z-sticky)",
        sidebar: "var(--nf-z-sidebar)",
        topbar: "var(--nf-z-topbar)",
        drawer: "var(--nf-z-drawer)",
        overlay: "var(--nf-z-overlay)",
        modal: "var(--nf-z-modal)",
        popover: "var(--nf-z-popover)",
        toast: "var(--nf-z-toast)",
        tooltip: "var(--nf-z-tooltip)",
      },
      transitionDuration: {
        instant: "var(--nf-duration-instant)",
        fast: "var(--nf-duration-fast)",
        DEFAULT: "var(--nf-duration-base)",
        slow: "var(--nf-duration-slow)",
      },
      transitionTimingFunction: {
        standard: "var(--nf-ease-standard)",
      },
      screens: {
        xs: "390px",
      },
      maxWidth: {
        content: "var(--nf-content-max)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
