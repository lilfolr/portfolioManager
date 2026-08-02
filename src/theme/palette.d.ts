/** Types for `palette.js`, which is plain CommonJS so the Tailwind config can
 * `require()` the same object the app imports. */

export type LedgerPalette = {
  ink: string;
  strong: string;
  mid: string;
  muted: string;
  faint: string;

  link: string;
  linkHover: string;

  positive: string;
  negative: string;

  surfaceSidebar: string;
  surfaceTable: string;
  surfaceTopBar: string;
  surfaceActive: string;
  surfaceGroupHead: string;
  surfaceParcelTint: string;
  surfaceInfoBox: string;
  surfaceWarnBox: string;
  surfacePage: string;
  surfaceCard: string;
  surfaceHover: string;

  edgeCard: string;
  edgeSidebar: string;
  edgeSubtle: string;
  edgeRow: string;
  edgeHeaderRule: string;
  edgeControl: string;
  edgeControlHover: string;
  edgeButton: string;
  edgeTotalRule: string;
  edgeInfoBox: string;
  edgeWarnBox: string;

  heldEligibleFg: string;
  heldEligibleBg: string;
  heldEligibleBorder: string;
  heldNotYetFg: string;
  heldNotYetBg: string;
  heldNotYetBorder: string;

  pendingAmber: string;
  pendingText: string;

  avatarBg: string;
  avatarBorder: string;
  badgeBg: string;
  badgeBorder: string;
  iconMuted: string;
};

export declare const light: LedgerPalette;
export declare const dark: LedgerPalette;
export declare const ramp: { light: string[]; dark: string[] };
export declare const sourceDots: {
  light: Record<string, string>;
  dark: Record<string, string>;
};
export declare function kebab(key: string): string;
export declare function channels(hex: string): string;
