const { light, ramp, kebab } = require('./src/theme/palette');

/** Every token resolves through its CSS variable, so a class works in both themes. */
const varColor = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const tokenColors = Object.fromEntries(
  Object.keys(light).map((key) => [kebab(key), varColor(kebab(key))]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // REPLACING `theme.colors` rather than extending it deletes Tailwind's
    // default palette: `bg-white`, `text-black` and `border-red-500` stop
    // producing any style at all. That is the enforceable equivalent of
    // CLAUDE.md's "never hardcode a Colors.* value" -- stronger than the
    // Flutter convention, which relied on review to catch it.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ...tokenColors,
      comp: Object.fromEntries(
        ramp.light.map((_, i) => [i + 1, varColor(`comp-${i + 1}`)]),
      ),
    },
    // Only the two breakpoints the design actually uses, matching the
    // `LayoutBuilder` thresholds in `lib/app_shell.dart`.
    screens: {
      mid: '600px',
      wide: '1000px',
    },
    // On native a font weight is a separate family, not a `fontWeight` value:
    // `font-mono font-medium` silently does nothing. `fontWeight` is therefore
    // removed from the theme so `font-medium`/`font-bold` don't exist, and each
    // weight gets its own family name.
    fontFamily: {
      sans: ['IBMPlexSans_400Regular'],
      'sans-med': ['IBMPlexSans_500Medium'],
      'sans-semi': ['IBMPlexSans_600SemiBold'],
      mono: ['IBMPlexMono_400Regular'],
      'mono-med': ['IBMPlexMono_500Medium'],
    },
    fontWeight: {},
    extend: {},
  },
  plugins: [require('./src/theme/tailwind-plugin')],
};
