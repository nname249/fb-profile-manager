/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/renderer/index.html",
        "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'fb-blue': '#0084ff',
                'fb-bg-main': '#0c0e12',
                'fb-bg-card': 'rgba(26, 29, 35, 0.7)',
                'fb-bg-header': '#14171d',
            }
        },
    },
    plugins: [],
}
