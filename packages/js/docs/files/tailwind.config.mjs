/* this file is created by the @magicsandbox.ai/docs package. do not edit manually as it will be overwritten */

import typography from "@tailwindcss/typography";

export default {
  theme: {
    extend: {
      typography: (theme) => ({
        DEFAULT: {
          css: {
            h1: {
              color: "#000000",
            },
          },
        },
        sm: {
          css: {
            //these only apply to the nav section, which uses prose-sm
            a: {
              color: theme("colors.stone.700"),
              fontWeight: theme("fontWeight.normal"),
            },
            p: {
              margin: "0px",
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};
