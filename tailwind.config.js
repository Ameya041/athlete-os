/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0F0C",
        bgElev: "#11160F",
        bgElev2: "#171D15",
        paper: "#12170F",
        paperDim: "#1B221A",
        ink: "#F1F4EF",
        inkMuted: "#8B978A",
        cream: "#F1F4EF",
        muted: "#7C897B",
        muted2: "#57625A",
        seam: "#22C55E",
        seamDim: "#16A34A",
        alert: "#F0554A",
        alertDim: "#C73E35",
        willow: "#D4B25A",
        good: "#22C55E"
      },
      fontFamily: {
        display: ["'Inter'", "sans-serif"],
        serif: ["'Inter'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      }
    }
  },
  plugins: []
};
