// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // if you have an /app folder outside /src
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
