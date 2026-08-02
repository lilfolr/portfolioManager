const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const HEX = '^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'supabase/**', 'lib/**'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    rules: {
      // CLAUDE.md: "Resolve colours from the active theme -- never hardcode a
      // colour value or literal hex, and never give a colour parameter a
      // light-only default." src/theme/palette.js is the one exemption, and it
      // is .js so it isn't matched by `files` above.
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${HEX}/]`,
          message:
            'No colour literals. Add a token to src/theme/palette.js and use the utility class or useLedgerColors().',
        },
      ],
      // Money and quantity are Decimal end to end; `number` appears only
      // inside src/domain/format.ts, at the point a figure becomes text.
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message:
            'Never parse a wire value to a float -- numeric(20,8) loses precision. Use D() from src/domain/decimal.',
        },
      ],
    },
  },
]);
