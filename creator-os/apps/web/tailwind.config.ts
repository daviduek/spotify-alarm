import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0d12",
        panel: "#12151c",
        edge: "#222734",
        accent: "#c9a24b",
      },
    },
  },
  plugins: [],
};

export default config;
