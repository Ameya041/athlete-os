/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#10241C",
        bgElev: "#17281F",
        bgElev2: "#1E3126",
        paper: "#F4EFE1",
        paperDim: "#E8DFC5",
        ink: "#202D26",
        inkMuted: "#7A6F5C",
        cream: "#F1ECDE",
        muted: "#93A69B",
        muted2: "#6C7D73",
        seam: "#AE3529",
        seamDim: "#7A241C",
        willow: "#C69A3E",
        good: "#4C7A54"
      },
      fontFamily: {
        display: ["'Big Shoulders Display'", "sans-serif"],
        serif: ["'Source Serif 4'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      }
    }
  },
  plugins: []
};
