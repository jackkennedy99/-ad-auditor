import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFAF5',
          100: '#FAF5EC',
          200: '#F3EAD8',
          300: '#E8DCC4',
        },
        sage: {
          100: '#DDE8DD',
          200: '#C0D4C0',
          300: '#9CBF9C',
          400: '#7AA87A',
          500: '#5A8E5A',
          600: '#3D733D',
          700: '#2D572D',
        },
        forest: '#2D3428',
        moss: '#4A5240',
        fern: '#7A8870',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
