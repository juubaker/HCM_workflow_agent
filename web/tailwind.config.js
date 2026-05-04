/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"Manrope"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        // Warm dark slate palette
        ink: {
          950: "#0F0E0C",
          900: "#15140F",
          800: "#1A1916",
          700: "#252320",
          600: "#36332C",
          500: "#4A463E",
          400: "#6B665B",
          300: "#A8A296",
          200: "#D4CFC1",
          100: "#F5F1E8",
        },
        // Single warm accent — sodium-vapor amber
        amber: {
          DEFAULT: "#E8A547",
          dim: "#B8821F",
          glow: "#F5C77A",
        },
        // Semantic colors, muted to fit the palette
        success: "#7DC76E",
        denied: "#D4756A",
        llm: "#9C82C4",
        info: "#6FAFCC",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
