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
                primary: '#9C4221',
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
                display: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
