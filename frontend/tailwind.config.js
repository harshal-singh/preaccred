/** @type {import('tailwindcss').Config} */
import { SharedColors, NeutralColors, CommunicationColors, LocalizedFontNames, LocalizedFontFamilies } from '@fluentui/theme';
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...CommunicationColors,
        ...SharedColors,
        ...NeutralColors,
      },
      fontFamily: {
        ...LocalizedFontFamilies,
        ...LocalizedFontNames
      }
    },
  },
  plugins: [require("@fluentui/theme")],
}
