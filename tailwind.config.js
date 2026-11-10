/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      colors: {
        ink: '#05060a',
        bone: '#f2ede3',
        amber: '#ffb547',
        coral: '#ff5d73',
        violet: '#7c5cff',
        teal: '#2de2c5',
        sky: '#4cc9ff'
      },
      keyframes: {
        drift: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(3%,-4%,0) scale(1.08)' } },
        shimmer: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '200% 50%' } },
        pulseDot: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } }
      },
      animation: { drift: 'drift 14s ease-in-out infinite', shimmer: 'shimmer 6s linear infinite', pulseDot: 'pulseDot 1.6s ease-in-out infinite' }
    }
  },
  plugins: []
};
