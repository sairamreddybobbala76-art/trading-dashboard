/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#11171B',
        surface: '#1a2329',
        panel: '#1e2d35',
        muted: '#44545B',
        text: '#E9ECEC',
        accent: '#00d4aa',
        bull: '#26a69a',
        bear: '#ef5350',
        warn: '#ffb74d',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
