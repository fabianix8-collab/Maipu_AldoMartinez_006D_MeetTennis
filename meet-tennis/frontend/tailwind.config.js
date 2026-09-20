/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#059669', // emerald-600
        },
        secondary: {
          DEFAULT: '#047857', // emerald-700
          accent: '#fbbf24', // amber-400
        },
        surface: {
          dark: '#0f172a', // slate-900
          DEFAULT: '#1e293b', // slate-800
        },
        text: {
          primary: '#f1f5f9', // slate-100
          secondary: '#94a3b8', // slate-400
        },
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
