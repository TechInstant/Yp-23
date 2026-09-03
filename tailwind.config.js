/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sampled from the RCCG seal and the Youth Province 23 mark:
        // deep indigo-navy body, gold for emphasis, and the four accent hues
        // from the "23" swoosh for chart series.
        navy: {
          50: '#F2F4FB',
          100: '#E2E7F5',
          200: '#C3CCEA',
          300: '#96A5D6',
          400: '#6478BC',
          500: '#4055A0',
          600: '#2E3F81',
          700: '#233268',
          800: '#1B2854',
          900: '#16225A',
          950: '#0D1436',
        },
        gold: {
          50: '#FDF8EC',
          100: '#F9EDCD',
          200: '#F2D998',
          300: '#E7C063',
          400: '#D9A83C',
          500: '#C99A2E',
          600: '#A67A22',
          700: '#825D1D',
          800: '#5D421A',
          900: '#3D2C13',
        },
        brand: {
          blue: '#1B57A5',
          magenta: '#D6216E',
          orange: '#F09A1E',
          green: '#2E9B4F',
          red: '#C0392B',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(13, 20, 54, 0.05), 0 8px 24px -12px rgba(13, 20, 54, 0.18)',
      },
    },
  },
  plugins: [],
}
