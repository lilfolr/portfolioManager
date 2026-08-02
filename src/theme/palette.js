// The ledger palette. Ported 1:1 from `lib/theme/ledger_theme.dart`'s
// `LedgerPalette.light` / `.dark`, which in turn came from the
// `Holdings Hi-Fi.dc.html` design. The dark variant preserves that design's
// warm paper/sepia character rather than inverting it.
//
// This is the ONLY file in the codebase allowed to contain a colour literal
// (enforced by the `no-restricted-syntax` hex rule in eslint.config.js).
// It is plain CommonJS `.js` on purpose: `tailwind.config.js` `require()`s it
// under Node to generate both the CSS custom properties and the utility class
// names, and app code imports it through Metro for the cases a class name
// can't express (the composition ramp, the source-dot map). One source of
// truth, no generated file to drift.
//
// Naming differs from the Dart fields in two mechanical ways, so the utility
// classes read properly:
//   textStrong/textMid/...  ->  strong/mid/...    ("text-mid", not "text-text-mid")
//   borderCard/borderRow/... ->  edgeCard/edgeRow/... ("border-edge-row")

/** @type {Record<string, string>} */
const light = {
  ink: '#1A1916',
  strong: '#3D3A33',
  mid: '#57534A',
  muted: '#8A8479',
  faint: '#A09A8D',

  link: '#3A5A8C',
  linkHover: '#28406A',

  positive: '#2F6A4A',
  negative: '#8F4A37',

  surfaceSidebar: '#FBFAF7',
  surfaceTable: '#FAF9F6',
  surfaceTopBar: '#FDFCFA',
  surfaceActive: '#F0EEE8',
  surfaceGroupHead: '#F4F2EC',
  surfaceParcelTint: '#FDFCF9',
  surfaceInfoBox: '#F7F8FC',
  surfaceWarnBox: '#FDFAF1',
  surfacePage: '#F4F2ED',
  surfaceCard: '#FFFFFF',
  surfaceHover: '#F1EFE9',

  edgeCard: '#DFDBD1',
  edgeSidebar: '#E4E0D7',
  edgeSubtle: '#E9E5DC',
  edgeRow: '#F0ECE3',
  edgeHeaderRule: '#DDD8CD',
  edgeControl: '#E0DBD1',
  edgeControlHover: '#C9C2B4',
  edgeButton: '#DCD7CB',
  edgeTotalRule: '#CFC8B9',
  edgeInfoBox: '#E2E5EE',
  edgeWarnBox: '#E9E2CF',

  heldEligibleFg: '#2F6A4A',
  heldEligibleBg: '#F4F8F5',
  heldEligibleBorder: '#DDE8E0',
  heldNotYetFg: '#8A6A3A',
  heldNotYetBg: '#FDFAF1',
  heldNotYetBorder: '#E9E2CF',

  pendingAmber: '#A8894A',
  pendingText: '#7A6F57',

  avatarBg: '#E7E3D9',
  avatarBorder: '#DCD7CB',
  badgeBg: '#E9EAF2',
  badgeBorder: '#D3D7E6',
  iconMuted: '#BDB7A9',
};

/** @type {Record<string, string>} */
const dark = {
  ink: '#F2EFE7',
  strong: '#E8E4DA',
  mid: '#A8A196',
  muted: '#8A8479',
  faint: '#7A746A',

  link: '#8FAAD6',
  linkHover: '#AFC4E6',

  positive: '#6FBF92',
  negative: '#D98F73',

  surfaceSidebar: '#1C1A15',
  surfaceTable: '#1A1813',
  surfaceTopBar: '#1E1B16',
  surfaceActive: '#29261F',
  surfaceGroupHead: '#242119',
  surfaceParcelTint: '#1D1B15',
  surfaceInfoBox: '#1D1F29',
  surfaceWarnBox: '#262115',
  surfacePage: '#16150F',
  surfaceCard: '#1E1C16',
  surfaceHover: '#29261F',

  edgeCard: '#35322A',
  edgeSidebar: '#302D25',
  edgeSubtle: '#2C2921',
  edgeRow: '#272419',
  edgeHeaderRule: '#35322A',
  edgeControl: '#35322A',
  edgeControlHover: '#48453A',
  edgeButton: '#3A372E',
  edgeTotalRule: '#48453A',
  edgeInfoBox: '#2C3040',
  edgeWarnBox: '#352E1D',

  heldEligibleFg: '#6FBF92',
  heldEligibleBg: '#1D2A20',
  heldEligibleBorder: '#2E4536',
  heldNotYetFg: '#D3A968',
  heldNotYetBg: '#262115',
  heldNotYetBorder: '#3D361F',

  pendingAmber: '#D3A968',
  pendingText: '#B0A488',

  avatarBg: '#2E2B22',
  avatarBorder: '#3A372E',
  badgeBg: '#232636',
  badgeBorder: '#343A54',
  iconMuted: '#6B6558',
};

// Composition-bar ramp, used when segmenting "by holding". Nine stops.
const ramp = {
  light: [
    '#2F4A75',
    '#3A5A8C',
    '#4A6B9C',
    '#5C7CAD',
    '#7089B9',
    '#8497C4',
    '#99A7CF',
    '#ADB7D9',
    '#C2C8E3',
  ],
  dark: [
    '#5C7CAD',
    '#6E8CBA',
    '#7C99C4',
    '#8CA7CE',
    '#9BB4D6',
    '#ABC1DF',
    '#BACDE6',
    '#CADAEE',
    '#DAE6F4',
  ],
};

// Source-account dot colours, keyed by the account display name. Unknown keys
// fall back to `faint` -- see `sourceDot()` in use-ledger-colors.ts, matching
// the Dart `sourceDots[source] ?? textFaint`.
const sourceDots = {
  light: {
    'CommSec 0421': '#3A5A8C',
    'Stake AU': '#4A6F6A',
    'Stake US': '#4A6F6A',
    'Computershare · SRN': '#7A6F57',
    'MUFG · SRN': '#8A6A7A',
  },
  dark: {
    'CommSec 0421': '#7E9BC7',
    'Stake AU': '#7FA69F',
    'Stake US': '#7FA69F',
    'Computershare · SRN': '#AB9E7C',
    'MUFG · SRN': '#B093A3',
  },
};

/** `surfaceCard` -> `surface-card`. Used for both CSS var and class names. */
const kebab = (key) => key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

/** `'#1A1916'` -> `'26 25 22'`, the channel form Tailwind's alpha syntax needs. */
const channels = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

module.exports = { light, dark, ramp, sourceDots, kebab, channels };
