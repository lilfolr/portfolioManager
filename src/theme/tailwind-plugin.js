// Emits the ledger palette as CSS custom properties, once per theme, from the
// same `palette.js` that `tailwind.config.js` builds its colour names out of.
// Generating them here rather than hand-writing them into `global.css` is what
// makes drift between the two impossible.
//
// `.dark:root` is NativeWind's class strategy (`darkMode: 'class'`), which it
// also honours on native -- the variable table is compiled out of the CSS at
// build time and shipped into the native runtime.
const plugin = require('tailwindcss/plugin');
const { light, dark, ramp, channels, kebab } = require('./palette');

const vars = (tokens, rampStops) => ({
  ...Object.fromEntries(
    Object.entries(tokens).map(([key, hex]) => [`--${kebab(key)}`, channels(hex)]),
  ),
  ...Object.fromEntries(
    rampStops.map((hex, i) => [`--comp-${i + 1}`, channels(hex)]),
  ),
});

module.exports = plugin(({ addBase }) => {
  addBase({
    ':root': vars(light, ramp.light),
    '.dark:root': vars(dark, ramp.dark),
  });
});
