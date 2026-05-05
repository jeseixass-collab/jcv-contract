/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'doc-text': '#1a1a1a',
        'doc-muted': '#4a4a4a',
        'doc-light': '#888888',
        'doc-border': '#d0d0d0',
        'doc-divider': '#c0c0c0',
        'doc-section-bg': '#f5f5f5',
        'doc-accent': '#b45309',
        'doc-accent-bg': '#fef3c7',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}
