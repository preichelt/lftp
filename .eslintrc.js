module.exports = {
  "root": true,
  "env": {
    "es6": true,
    "node": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "parser": "babel-eslint",
  "plugins": [
    "import"
  ],
  "rules": {
    "indent": [
      "error",
      2,
      {
        "SwitchCase": 1
      }
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "error",
      "never"
    ],
    "arrow-parens": [
      "error",
      "always"
    ],
    "no-debugger": process.env.NODE_ENV === "production" ? 2 : 0,
    "no-console": 0,
    "no-case-declarations": 0
  }
};
