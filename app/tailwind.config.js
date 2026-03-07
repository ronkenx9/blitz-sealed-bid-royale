/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                cyber: {
                    bg: '#05050A',
                    panel: '#0D0D16',
                    panel2: '#161622',
                    border: '#2A2A40',
                    text: '#E2E8F0',
                    muted: '#8B8B9B',
                    cyan: '#00F0FF',
                    pink: '#FF003C',
                    green: '#00FF66',
                    gold: '#FFD700'
                }
            },
            fontFamily: {
                'sans': ['"Outfit"', 'sans-serif'],
                'display': ['"Space Grotesk"', 'sans-serif'],
                'mono': ['"Fira Code"', 'monospace'],
            },
            animation: {
                'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'subtle-float': 'subtleFloat 4s ease-in-out infinite',
            },
            keyframes: {
                pulseGlow: {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: .7, filter: 'brightness(1.5)' },
                },
                subtleFloat: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                }
            }
        },
    },
    plugins: [],
}
