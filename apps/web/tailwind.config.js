/** @type {import('tailwindcss').Config} */
module.exports = {
  // Extend the UI package configuration
  presets: [require('@ventry/ui/tailwind.config.js')],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    // Include UI package components (source only for performance)
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
}