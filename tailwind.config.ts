import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1a1a1a",
        card: "#252525",
        "accent-green": "#22c55e",
        "accent-gold": "#eab308",
        foreground: "#e5e5e5",
      },
    },
  },
  plugins: [],
};

export default config;
