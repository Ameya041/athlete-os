/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#121C17",
        bgElev: "#1B2620",
        bgElev2: "#22302A",
        cream: "#F1ECDE",
        muted: "#93A69B",
        muted2: "#6C7D73",
        seam: "#C1443C",
        willow: "#C9A227",
        good: "#7FB88A"
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      }
    }
  },
  plugins: []
};
