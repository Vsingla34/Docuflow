/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './{App,index}.tsx', './{components,pages,store,lib,data}/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        'primary-dark': '#4338CA',
        secondary: '#0D9488',
        background: '#F1F5F9',
        sidebar: '#0F172A',
        'sidebar-hover': '#1E293B',
        'text-main': '#0F172A',
        'text-light': '#64748B',
        card: '#FFFFFF',
        border: '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
