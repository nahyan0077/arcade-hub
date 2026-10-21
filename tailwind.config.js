/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.18)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        'draw-line': {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        'win-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(250, 204, 21, 0.7)' },
          '50%': { boxShadow: '0 0 24px 8px rgba(250, 204, 21, 0.45)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'emoji-float': {
          '0%': { transform: 'translateY(0) scale(0.5)', opacity: '0' },
          '15%': { transform: 'translateY(-12px) scale(1.15)', opacity: '1' },
          '100%': { transform: 'translateY(-100px) scale(1)', opacity: '0' },
        },
        'card-glow': {
          '0%, 100%': { boxShadow: '0 0 18px -6px rgba(59, 130, 246, 0.55)' },
          '50%': { boxShadow: '0 0 26px -2px rgba(59, 130, 246, 0.75)' },
        },
      },
      animation: {
        pop: 'pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shake: 'shake 0.3s ease-in-out',
        'draw-line': 'draw-line 0.6s ease-out 0.2s both',
        'confetti-fall': 'confetti-fall linear forwards',
        'win-pulse': 'win-pulse 1.2s ease-in-out infinite',
        'fade-in': 'fade-in 0.45s ease-out both',
        'slide-up': 'slide-up 0.22s ease-out both',
        'emoji-float': 'emoji-float 1.5s ease-out forwards',
        'card-glow': 'card-glow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}