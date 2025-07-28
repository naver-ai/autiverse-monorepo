/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      height: {
        "header": "48px",
      },
      colors: {
        "autiverse": {
          "yellow": "#ffb33a",
        }
      }
    },
  },
  plugins: [],
}

