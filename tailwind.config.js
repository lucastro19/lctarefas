/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Valores light mode — Tailwind gera CSS hex correto
        // Dark mode é sobrescrito via html.dark em index.css
        bg:               "#F2F2F7",
        card:             "#FFFFFF",
        sidebar:          "#F9F9F9",
        border:           "#E5E5EA",
        "text-main":      "#1C1C1E",
        "text-secondary": "#8E8E93",
        primary:  "#4F8EF7",
        success:  "#34C759",
        warning:  "#FF9500",
        danger:   "#FF3B30",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
