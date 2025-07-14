import typography from "@tailwindcss/typography";
import daisyui from "daisyui";

export default {
  content: ["apps/Assistant/**/*.tsx", "components/**/*.tsx"],
  plugins: [typography, daisyui],
  daisyui: {
    styled: false,
    themes: [],
  },
};
