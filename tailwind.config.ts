import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFDF7',
        ink: '#1C1917',
        muted: '#78716C',
        onPrimary: '#1F1700',
        primary: {
          50: '#FFFBEB',
          100: '#FFF3C4',
          200: '#FFE58A',
          300: '#FFD84D',
          400: '#FFC926',
          500: '#FFC93C',
          600: '#F5B700',
          700: '#A67200',
          800: '#7A5400',
          900: '#4D3600',
        },
        status: {
          en_attente: '#0EA5E9',
          paye: '#10B981',
          refuse: '#F43F5E',
          probleme: '#8B5CF6',
        },
      },
      borderRadius: {
        card: '24px',
        control: '16px',
      },
      boxShadow: {
        soft: '0 12px 40px rgba(166, 114, 0, 0.15)',
        raised: '0 20px 60px rgba(166, 114, 0, 0.20)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
