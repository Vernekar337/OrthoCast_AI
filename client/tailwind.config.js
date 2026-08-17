/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#0F6E6B',
          50:  '#E8F5F5',
          100: '#C5E6E5',
          200: '#8ECCCA',
          300: '#57B3B0',
          400: '#2E9995',
          500: '#0F6E6B',
          600: '#0C5957',
          700: '#094443',
          800: '#062F2E',
          900: '#031A1A',
        },
        navy: {
          DEFAULT: '#1F3864',
          50:  '#EEF1F8',
          100: '#CDD5EC',
          200: '#9BAAD8',
          300: '#6980C5',
          400: '#3A57B1',
          500: '#1F3864',
          600: '#192E52',
          700: '#13233F',
          800: '#0D182B',
          900: '#060C18',
        },
        accent: {
          DEFAULT: '#4A90D9',
          50:  '#EBF4FD',
          100: '#C8E3F9',
          200: '#91C7F3',
          300: '#5AABEE',
          400: '#4A90D9',
          500: '#2D76C4',
          600: '#2260A3',
          700: '#184A82',
          800: '#0F3461',
          900: '#071E40',
        },
        clinical: {
          bg:     '#FAFAFA',
          card:   '#FFFFFF',
          border: '#E5E7EB',
          muted:  '#6B7280',
          subtle: '#F3F4F6',
          text:   '#111827',
          secondary: '#374151',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card:   '10px',
        btn:    '6px',
        input:  '6px',
      },
      boxShadow: {
        card:   '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)',
        topbar: '0 1px 0 #E5E7EB',
      },
      animation: {
        'fade-in':     'fadeIn 0.25s ease-out forwards',
        'slide-in':    'slideIn 0.25s ease-out forwards',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};