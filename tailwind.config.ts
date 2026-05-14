import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        black: "var(--black)",
        white: "var(--white)",
        gray: "var(--gray)",
        surface: "var(--surface)",
        border: "var(--border)",
        bg: "var(--bg)",
      },
      fontFamily: {
        sans: ["Neue Haas Grotesk Display", "Neue Haas Grotesk", "Helvetica Neue", "Helvetica Now Display", "ABC Diatype", "Univers", "Helvetica", "var(--font-inter)", "system-ui", "sans-serif"],
        display: ["Neue Haas Grotesk Display", "Neue Haas Grotesk", "Helvetica Neue", "Helvetica Now Display", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["Neue Haas Grotesk", "Helvetica Neue", "var(--font-inter)", "ui-monospace", "monospace"],
        body: ["Neue Haas Grotesk", "Helvetica Neue", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontWeight: {
        black: "900",
      },
      letterSpacing: {
        tightest: "-0.04em",
        display: "-0.06em",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
      transitionTimingFunction: {
        "smooth": "cubic-bezier(0.16, 1, 0.3, 1)",
        "cinematic": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "grain": "grain 8s steps(10) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-5%, -10%)" },
          "20%": { transform: "translate(-15%, 5%)" },
          "30%": { transform: "translate(7%, -25%)" },
          "40%": { transform: "translate(-5%, 25%)" },
          "50%": { transform: "translate(-15%, 10%)" },
          "60%": { transform: "translate(15%, 0%)" },
          "70%": { transform: "translate(0%, 15%)" },
          "80%": { transform: "translate(3%, 35%)" },
          "90%": { transform: "translate(-10%, 10%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
