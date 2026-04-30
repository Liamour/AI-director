import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        te: {
          // polymer plastic white — bright injection-molded, panels close to chassis
          bone: "#F7F5EF",
          "bone-dim": "#F1EEE4",
          "bone-deep": "#DDD8CC",
          "bone-edge": "#BCB6A6",
          charcoal: "#161616",
          "charcoal-soft": "#262626",
          "lcd-bg": "#1F2418",
          "lcd-fg": "#B8C77A",
          "lcd-dim": "#7A8A4A",
          // knobs are uniform polymer white now; accent colors used for label dots only
          "knob-white": "#FAFAF7",
          "knob-blue": "#2D5BA8",
          "knob-orange": "#E8862A",
          "knob-red": "#D63031",
          ok: "#7FB069",
          warn: "#FCBF49",
          err: "#E63946",
        },
      },
      fontFamily: {
        te: ["Inter", "Helvetica Neue", "Arial", "sans-serif"],
        "te-mono": ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
        lcd: ["VT323", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "te-key": "0 1px 0 rgba(255,255,255,0.6) inset, 0 -2px 4px rgba(0,0,0,0.15) inset, 0 2px 4px rgba(0,0,0,0.18)",
        "te-key-active": "0 2px 6px rgba(0,0,0,0.4) inset",
        "te-knob": "0 -2px 5px rgba(0,0,0,0.35) inset, 0 1px 2px rgba(255,255,255,0.5) inset, 0 3px 6px rgba(0,0,0,0.3)",
        "te-panel": "0 1px 0 rgba(255,255,255,0.4) inset, 0 -1px 0 rgba(0,0,0,0.1) inset, 0 2px 8px rgba(0,0,0,0.08)",
        "te-lcd": "0 0 0 1px rgba(0,0,0,0.4) inset, 0 0 12px rgba(0,0,0,0.5) inset",
      },
    },
  },
  plugins: [],
};

export default config;
