/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0F17',
          card: '#151C28',
          border: '#232D3F',
          accent: '#FF5722', // Strava / Garmin Orange Accent
          text: '#F3F4F6',
          muted: '#9CA3AF'
        },
        cycling: {
          road: '#3B82F6',
          mtb: '#10B981',
          hr: '#EF4444',
          power: '#F59E0B',
          cadence: '#8B5CF6',
          speed: '#06B6D4'
        }
      }
    },
  },
  plugins: [],
}
