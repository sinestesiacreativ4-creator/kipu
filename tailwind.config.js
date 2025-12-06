/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#9C4221',
                    hover: '#7d3519',
                    light: '#D97706',
                    50: '#fef3ee',
                    100: '#fce5d8',
                    200: '#f8c7af',
                    300: '#f3a17d',
                    400: '#ed7149',
                    500: '#e84d26',
                    600: '#9C4221',
                    700: '#7d3519',
                    800: '#632b15',
                    900: '#4a2211',
                },
                'primary-hover': '#7d3519',
                bone: '#FAF9F6',
                darkbg: '#0c0a09',
                gold: {
                    light: '#F4E5C2',
                    DEFAULT: '#D4AF37',
                    dark: '#B8941F'
                }
            },
            fontFamily: {
                display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
                sans: ['Outfit', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            boxShadow: {
                'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                '3xl': '0 35px 60px -12px rgba(0, 0, 0, 0.25)',
                'glow': '0 0 40px rgba(156, 66, 33, 0.3)',
                'glow-gold': '0 0 40px rgba(212, 175, 55, 0.3)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.5s ease-out forwards',
                'scale-in': 'scaleIn 0.3s ease-out forwards',
                'spin-slow': 'spin 3s linear infinite',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
            },
            transitionDuration: {
                '400': '400ms',
            },
            backdropBlur: {
                '3xl': '64px',
            },
        },
    },
    plugins: [],
}
