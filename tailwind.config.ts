import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#123C66",
          dark: "#0D2E4E",
          light: "#1a5490",
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "#2E8B57",
          light: "#3aa86a",
          foreground: "#ffffff",
        },
        background: "#F7F9FC",
        surface: "#FFFFFF",
        border: "#E5EAF2",
        text: {
          main: "#142033",
          muted: "#5E6B7A",
        },
        danger: "#C93C37",
        warning: "#D68A1A",
        success: "#2E8B57",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Manrope", "Inter", "sans-serif"],
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
        modal: "0 24px 80px rgba(0,0,0,0.18)",
        dropdown: "0 4px 16px rgba(0,0,0,0.10)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
