/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1c1917',
          muted: '#57534e',
          faint: '#a8a29e',
        },
        paper: {
          DEFAULT: '#f4f0e8',
          card: '#fffcf7',
        },
        brand: {
          DEFAULT: '#0f766e',
          dark: '#115e59',
          light: '#ccfbf1',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 25, 23, 0.06), 0 12px 32px -16px rgba(28, 25, 23, 0.18)',
      },
    },
  },
  plugins: [],
};
