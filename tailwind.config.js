/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F3F2EE',
        surface: '#FFFFFF',
        sunk: '#EAE8E2',
        line: { DEFAULT: '#DAD7CF', strong: '#A9A49A' },
        ink: { DEFAULT: '#1E2226', muted: '#555B63', faint: '#6B7078' },
        accent: { DEFAULT: '#1D5568', hover: '#153F4D', tint: '#E2ECEF', line: '#A3C2CC' },
        success: { DEFAULT: '#2D6641', tint: '#E3EFE6', line: '#A9CDB4' },
        warning: { DEFAULT: '#6F4B00', tint: '#F8EDD3', line: '#DCC183' },
        danger: { DEFAULT: '#9E2428', tint: '#FAE8E7', line: '#E0A7A4' },
        guarded: { DEFAULT: '#463C66', tint: '#ECE9F3', line: '#BDB4D6' },
      },
      fontFamily: {
        sans: ['"Public Sans Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        sm: ['0.875rem', { lineHeight: '1.35rem' }],
        base: ['1rem', { lineHeight: '1.55rem' }],
        lg: ['1.125rem', { lineHeight: '1.6rem' }],
        xl: ['1.3125rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.15rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      maxWidth: { form: '42rem' },
    },
  },
  plugins: [],
};
