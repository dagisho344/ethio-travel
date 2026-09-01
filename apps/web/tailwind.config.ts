import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        earth: '#8b5e34',
        highland: '#256d85',
        leaf: '#2f7d32',
        sunrise: '#d9902f',
      },
    },
  },
  plugins: [],
};

export default config;
