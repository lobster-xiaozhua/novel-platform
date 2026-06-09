import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ed',
          100: '#fdecd3',
          200: '#fad5a5',
          300: '#f6b86d',
          400: '#f19333',
          500: '#e8913a',
          600: '#d97018',
          700: '#b45313',
          800: '#924015',
          900: '#7a3515',
        },
        reading: {
          bg: '#FAFAF8',
          dark: '#0D0D0D',
          warm: '#C8C0B8',
          paper: '#F5F0E8',
        },
      },
      maxWidth: {
        reading: '720px',
        content: '1080px',
      },
      fontFamily: {
        serif: ['Georgia', 'Noto Serif SC', 'SimSun', 'serif'],
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        kai: ['STKaiti', 'KaiTi', 'Noto Serif SC', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
