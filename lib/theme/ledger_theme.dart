import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Palette for the Holdings ledger UI. The light variant is ported 1:1 from
/// the `Holdings Hi-Fi.dc.html` design; the dark variant preserves its warm
/// paper/sepia character rather than inverting it. Every literal lives here
/// rather than scattered through widgets so the design stays a single
/// source of truth. Resolve at build time with `LedgerColors.of(context)`.
class LedgerPalette extends ThemeExtension<LedgerPalette> {
  const LedgerPalette({
    required this.ink,
    required this.textStrong,
    required this.textMid,
    required this.textMuted,
    required this.textFaint,
    required this.link,
    required this.linkHover,
    required this.positive,
    required this.negative,
    required this.surfaceSidebar,
    required this.surfaceTable,
    required this.surfaceTopBar,
    required this.surfaceActive,
    required this.surfaceGroupHead,
    required this.surfaceParcelTint,
    required this.surfaceInfoBox,
    required this.surfaceWarnBox,
    required this.surfacePage,
    required this.surfaceCard,
    required this.surfaceHover,
    required this.borderCard,
    required this.borderSidebar,
    required this.borderSubtle,
    required this.borderRow,
    required this.borderHeaderRule,
    required this.borderControl,
    required this.borderControlHover,
    required this.borderButton,
    required this.borderTotalRule,
    required this.borderInfoBox,
    required this.borderWarnBox,
    required this.heldEligibleFg,
    required this.heldEligibleBg,
    required this.heldEligibleBorder,
    required this.heldNotYetFg,
    required this.heldNotYetBg,
    required this.heldNotYetBorder,
    required this.pendingAmber,
    required this.pendingText,
    required this.avatarBg,
    required this.avatarBorder,
    required this.badgeBg,
    required this.badgeBorder,
    required this.iconMuted,
    required this.compRamp,
    required this.sourceDots,
  });

  final Color ink;
  final Color textStrong;
  final Color textMid;
  final Color textMuted;
  final Color textFaint;

  final Color link;
  final Color linkHover;

  final Color positive;
  final Color negative;

  final Color surfaceSidebar;
  final Color surfaceTable;
  final Color surfaceTopBar;
  final Color surfaceActive;
  final Color surfaceGroupHead;
  final Color surfaceParcelTint;
  final Color surfaceInfoBox;
  final Color surfaceWarnBox;
  final Color surfacePage;

  /// Card / panel surface. Replaces the old flat `LedgerColors.white`
  /// literal so cards get an elevated tone rather than pure white in dark
  /// mode.
  final Color surfaceCard;

  /// Generic hover fill for list rows / nav items.
  final Color surfaceHover;

  final Color borderCard;
  final Color borderSidebar;
  final Color borderSubtle;
  final Color borderRow;
  final Color borderHeaderRule;
  final Color borderControl;
  final Color borderControlHover;
  final Color borderButton;
  final Color borderTotalRule;
  final Color borderInfoBox;
  final Color borderWarnBox;

  final Color heldEligibleFg;
  final Color heldEligibleBg;
  final Color heldEligibleBorder;
  final Color heldNotYetFg;
  final Color heldNotYetBg;
  final Color heldNotYetBorder;
  final Color pendingAmber;
  final Color pendingText;

  /// Sidebar user-avatar chip background/border.
  final Color avatarBg;
  final Color avatarBorder;

  /// Small identity badge (e.g. account-type tag) background/border.
  final Color badgeBg;
  final Color badgeBorder;

  /// Muted glyph colour for chevrons and small inline icons (row disclosure
  /// arrows, search-box slash hint).
  final Color iconMuted;

  /// Composition-bar ramp, used when segmenting "by holding".
  final List<Color> compRamp;

  /// Source-account dot colours, keyed by the same source strings used in
  /// the sample data.
  final Map<String, Color> sourceDots;

  Color sourceDot(String source) => sourceDots[source] ?? textFaint;

  static const light = LedgerPalette(
    ink: Color(0xFF1A1916),
    textStrong: Color(0xFF3D3A33),
    textMid: Color(0xFF57534A),
    textMuted: Color(0xFF8A8479),
    textFaint: Color(0xFFA09A8D),
    link: Color(0xFF3A5A8C),
    linkHover: Color(0xFF28406A),
    positive: Color(0xFF2F6A4A),
    negative: Color(0xFF8F4A37),
    surfaceSidebar: Color(0xFFFBFAF7),
    surfaceTable: Color(0xFFFAF9F6),
    surfaceTopBar: Color(0xFFFDFCFA),
    surfaceActive: Color(0xFFF0EEE8),
    surfaceGroupHead: Color(0xFFF4F2EC),
    surfaceParcelTint: Color(0xFFFDFCF9),
    surfaceInfoBox: Color(0xFFF7F8FC),
    surfaceWarnBox: Color(0xFFFDFAF1),
    surfacePage: Color(0xFFF4F2ED),
    surfaceCard: Color(0xFFFFFFFF),
    surfaceHover: Color(0xFFF1EFE9),
    borderCard: Color(0xFFDFDBD1),
    borderSidebar: Color(0xFFE4E0D7),
    borderSubtle: Color(0xFFE9E5DC),
    borderRow: Color(0xFFF0ECE3),
    borderHeaderRule: Color(0xFFDDD8CD),
    borderControl: Color(0xFFE0DBD1),
    borderControlHover: Color(0xFFC9C2B4),
    borderButton: Color(0xFFDCD7CB),
    borderTotalRule: Color(0xFFCFC8B9),
    borderInfoBox: Color(0xFFE2E5EE),
    borderWarnBox: Color(0xFFE9E2CF),
    heldEligibleFg: Color(0xFF2F6A4A),
    heldEligibleBg: Color(0xFFF4F8F5),
    heldEligibleBorder: Color(0xFFDDE8E0),
    heldNotYetFg: Color(0xFF8A6A3A),
    heldNotYetBg: Color(0xFFFDFAF1),
    heldNotYetBorder: Color(0xFFE9E2CF),
    pendingAmber: Color(0xFFA8894A),
    pendingText: Color(0xFF7A6F57),
    avatarBg: Color(0xFFE7E3D9),
    avatarBorder: Color(0xFFDCD7CB),
    badgeBg: Color(0xFFE9EAF2),
    badgeBorder: Color(0xFFD3D7E6),
    iconMuted: Color(0xFFBDB7A9),
    compRamp: [
      Color(0xFF2F4A75),
      Color(0xFF3A5A8C),
      Color(0xFF4A6B9C),
      Color(0xFF5C7CAD),
      Color(0xFF7089B9),
      Color(0xFF8497C4),
      Color(0xFF99A7CF),
      Color(0xFFADB7D9),
      Color(0xFFC2C8E3),
    ],
    sourceDots: <String, Color>{
      'CommSec 0421': Color(0xFF3A5A8C),
      'Stake AU': Color(0xFF4A6F6A),
      'Stake US': Color(0xFF4A6F6A),
      'Computershare · SRN': Color(0xFF7A6F57),
      'MUFG · SRN': Color(0xFF8A6A7A),
    },
  );

  static const dark = LedgerPalette(
    ink: Color(0xFFF2EFE7),
    textStrong: Color(0xFFE8E4DA),
    textMid: Color(0xFFA8A196),
    textMuted: Color(0xFF8A8479),
    textFaint: Color(0xFF7A746A),
    link: Color(0xFF8FAAD6),
    linkHover: Color(0xFFAFC4E6),
    positive: Color(0xFF6FBF92),
    negative: Color(0xFFD98F73),
    surfaceSidebar: Color(0xFF1C1A15),
    surfaceTable: Color(0xFF1A1813),
    surfaceTopBar: Color(0xFF1E1B16),
    surfaceActive: Color(0xFF29261F),
    surfaceGroupHead: Color(0xFF242119),
    surfaceParcelTint: Color(0xFF1D1B15),
    surfaceInfoBox: Color(0xFF1D1F29),
    surfaceWarnBox: Color(0xFF262115),
    surfacePage: Color(0xFF16150F),
    surfaceCard: Color(0xFF1E1C16),
    surfaceHover: Color(0xFF29261F),
    borderCard: Color(0xFF35322A),
    borderSidebar: Color(0xFF302D25),
    borderSubtle: Color(0xFF2C2921),
    borderRow: Color(0xFF272419),
    borderHeaderRule: Color(0xFF35322A),
    borderControl: Color(0xFF35322A),
    borderControlHover: Color(0xFF48453A),
    borderButton: Color(0xFF3A372E),
    borderTotalRule: Color(0xFF48453A),
    borderInfoBox: Color(0xFF2C3040),
    borderWarnBox: Color(0xFF352E1D),
    heldEligibleFg: Color(0xFF6FBF92),
    heldEligibleBg: Color(0xFF1D2A20),
    heldEligibleBorder: Color(0xFF2E4536),
    heldNotYetFg: Color(0xFFD3A968),
    heldNotYetBg: Color(0xFF262115),
    heldNotYetBorder: Color(0xFF3D361F),
    pendingAmber: Color(0xFFD3A968),
    pendingText: Color(0xFFB0A488),
    avatarBg: Color(0xFF2E2B22),
    avatarBorder: Color(0xFF3A372E),
    badgeBg: Color(0xFF232636),
    badgeBorder: Color(0xFF343A54),
    iconMuted: Color(0xFF6B6558),
    compRamp: [
      Color(0xFF5C7CAD),
      Color(0xFF6E8CBA),
      Color(0xFF7C99C4),
      Color(0xFF8CA7CE),
      Color(0xFF9BB4D6),
      Color(0xFFABC1DF),
      Color(0xFFBACDE6),
      Color(0xFFCADAEE),
      Color(0xFFDAE6F4),
    ],
    sourceDots: <String, Color>{
      'CommSec 0421': Color(0xFF7E9BC7),
      'Stake AU': Color(0xFF7FA69F),
      'Stake US': Color(0xFF7FA69F),
      'Computershare · SRN': Color(0xFFAB9E7C),
      'MUFG · SRN': Color(0xFFB093A3),
    },
  );

  @override
  LedgerPalette copyWith({
    Color? ink,
    Color? textStrong,
    Color? textMid,
    Color? textMuted,
    Color? textFaint,
    Color? link,
    Color? linkHover,
    Color? positive,
    Color? negative,
    Color? surfaceSidebar,
    Color? surfaceTable,
    Color? surfaceTopBar,
    Color? surfaceActive,
    Color? surfaceGroupHead,
    Color? surfaceParcelTint,
    Color? surfaceInfoBox,
    Color? surfaceWarnBox,
    Color? surfacePage,
    Color? surfaceCard,
    Color? surfaceHover,
    Color? borderCard,
    Color? borderSidebar,
    Color? borderSubtle,
    Color? borderRow,
    Color? borderHeaderRule,
    Color? borderControl,
    Color? borderControlHover,
    Color? borderButton,
    Color? borderTotalRule,
    Color? borderInfoBox,
    Color? borderWarnBox,
    Color? heldEligibleFg,
    Color? heldEligibleBg,
    Color? heldEligibleBorder,
    Color? heldNotYetFg,
    Color? heldNotYetBg,
    Color? heldNotYetBorder,
    Color? pendingAmber,
    Color? pendingText,
    Color? avatarBg,
    Color? avatarBorder,
    Color? badgeBg,
    Color? badgeBorder,
    Color? iconMuted,
    List<Color>? compRamp,
    Map<String, Color>? sourceDots,
  }) {
    return LedgerPalette(
      ink: ink ?? this.ink,
      textStrong: textStrong ?? this.textStrong,
      textMid: textMid ?? this.textMid,
      textMuted: textMuted ?? this.textMuted,
      textFaint: textFaint ?? this.textFaint,
      link: link ?? this.link,
      linkHover: linkHover ?? this.linkHover,
      positive: positive ?? this.positive,
      negative: negative ?? this.negative,
      surfaceSidebar: surfaceSidebar ?? this.surfaceSidebar,
      surfaceTable: surfaceTable ?? this.surfaceTable,
      surfaceTopBar: surfaceTopBar ?? this.surfaceTopBar,
      surfaceActive: surfaceActive ?? this.surfaceActive,
      surfaceGroupHead: surfaceGroupHead ?? this.surfaceGroupHead,
      surfaceParcelTint: surfaceParcelTint ?? this.surfaceParcelTint,
      surfaceInfoBox: surfaceInfoBox ?? this.surfaceInfoBox,
      surfaceWarnBox: surfaceWarnBox ?? this.surfaceWarnBox,
      surfacePage: surfacePage ?? this.surfacePage,
      surfaceCard: surfaceCard ?? this.surfaceCard,
      surfaceHover: surfaceHover ?? this.surfaceHover,
      borderCard: borderCard ?? this.borderCard,
      borderSidebar: borderSidebar ?? this.borderSidebar,
      borderSubtle: borderSubtle ?? this.borderSubtle,
      borderRow: borderRow ?? this.borderRow,
      borderHeaderRule: borderHeaderRule ?? this.borderHeaderRule,
      borderControl: borderControl ?? this.borderControl,
      borderControlHover: borderControlHover ?? this.borderControlHover,
      borderButton: borderButton ?? this.borderButton,
      borderTotalRule: borderTotalRule ?? this.borderTotalRule,
      borderInfoBox: borderInfoBox ?? this.borderInfoBox,
      borderWarnBox: borderWarnBox ?? this.borderWarnBox,
      heldEligibleFg: heldEligibleFg ?? this.heldEligibleFg,
      heldEligibleBg: heldEligibleBg ?? this.heldEligibleBg,
      heldEligibleBorder: heldEligibleBorder ?? this.heldEligibleBorder,
      heldNotYetFg: heldNotYetFg ?? this.heldNotYetFg,
      heldNotYetBg: heldNotYetBg ?? this.heldNotYetBg,
      heldNotYetBorder: heldNotYetBorder ?? this.heldNotYetBorder,
      pendingAmber: pendingAmber ?? this.pendingAmber,
      pendingText: pendingText ?? this.pendingText,
      avatarBg: avatarBg ?? this.avatarBg,
      avatarBorder: avatarBorder ?? this.avatarBorder,
      badgeBg: badgeBg ?? this.badgeBg,
      badgeBorder: badgeBorder ?? this.badgeBorder,
      iconMuted: iconMuted ?? this.iconMuted,
      compRamp: compRamp ?? this.compRamp,
      sourceDots: sourceDots ?? this.sourceDots,
    );
  }

  @override
  LedgerPalette lerp(ThemeExtension<LedgerPalette>? other, double t) {
    if (other is! LedgerPalette) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    List<Color> ramp(List<Color> a, List<Color> b) => [
      for (var i = 0; i < a.length; i++) c(a[i], b[i]),
    ];
    Map<String, Color> dots(Map<String, Color> a, Map<String, Color> b) => {
      for (final key in a.keys) key: c(a[key]!, b[key] ?? a[key]!),
    };
    return LedgerPalette(
      ink: c(ink, other.ink),
      textStrong: c(textStrong, other.textStrong),
      textMid: c(textMid, other.textMid),
      textMuted: c(textMuted, other.textMuted),
      textFaint: c(textFaint, other.textFaint),
      link: c(link, other.link),
      linkHover: c(linkHover, other.linkHover),
      positive: c(positive, other.positive),
      negative: c(negative, other.negative),
      surfaceSidebar: c(surfaceSidebar, other.surfaceSidebar),
      surfaceTable: c(surfaceTable, other.surfaceTable),
      surfaceTopBar: c(surfaceTopBar, other.surfaceTopBar),
      surfaceActive: c(surfaceActive, other.surfaceActive),
      surfaceGroupHead: c(surfaceGroupHead, other.surfaceGroupHead),
      surfaceParcelTint: c(surfaceParcelTint, other.surfaceParcelTint),
      surfaceInfoBox: c(surfaceInfoBox, other.surfaceInfoBox),
      surfaceWarnBox: c(surfaceWarnBox, other.surfaceWarnBox),
      surfacePage: c(surfacePage, other.surfacePage),
      surfaceCard: c(surfaceCard, other.surfaceCard),
      surfaceHover: c(surfaceHover, other.surfaceHover),
      borderCard: c(borderCard, other.borderCard),
      borderSidebar: c(borderSidebar, other.borderSidebar),
      borderSubtle: c(borderSubtle, other.borderSubtle),
      borderRow: c(borderRow, other.borderRow),
      borderHeaderRule: c(borderHeaderRule, other.borderHeaderRule),
      borderControl: c(borderControl, other.borderControl),
      borderControlHover: c(borderControlHover, other.borderControlHover),
      borderButton: c(borderButton, other.borderButton),
      borderTotalRule: c(borderTotalRule, other.borderTotalRule),
      borderInfoBox: c(borderInfoBox, other.borderInfoBox),
      borderWarnBox: c(borderWarnBox, other.borderWarnBox),
      heldEligibleFg: c(heldEligibleFg, other.heldEligibleFg),
      heldEligibleBg: c(heldEligibleBg, other.heldEligibleBg),
      heldEligibleBorder: c(heldEligibleBorder, other.heldEligibleBorder),
      heldNotYetFg: c(heldNotYetFg, other.heldNotYetFg),
      heldNotYetBg: c(heldNotYetBg, other.heldNotYetBg),
      heldNotYetBorder: c(heldNotYetBorder, other.heldNotYetBorder),
      pendingAmber: c(pendingAmber, other.pendingAmber),
      pendingText: c(pendingText, other.pendingText),
      avatarBg: c(avatarBg, other.avatarBg),
      avatarBorder: c(avatarBorder, other.avatarBorder),
      badgeBg: c(badgeBg, other.badgeBg),
      badgeBorder: c(badgeBorder, other.badgeBorder),
      iconMuted: c(iconMuted, other.iconMuted),
      compRamp: ramp(compRamp, other.compRamp),
      sourceDots: dots(sourceDots, other.sourceDots),
    );
  }
}

/// Entry point for resolving the active [LedgerPalette] from a
/// [BuildContext]. Kept under the old `LedgerColors` name so call sites read
/// as a mechanical `LedgerColors.x` -> `LedgerColors.of(context).x` change.
class LedgerColors {
  LedgerColors._();

  static LedgerPalette of(BuildContext context) =>
      Theme.of(context).extension<LedgerPalette>() ?? LedgerPalette.light;
}

/// Text style helpers. Every style used on a numeric/figure cell must carry
/// [FontFeature.tabularFigures] so columns stay aligned — the design relies
/// on `font-variant-numeric:tabular-nums` almost everywhere numbers appear.
class LedgerText {
  LedgerText._();

  static TextStyle sans({
    double size = 13,
    FontWeight weight = FontWeight.w400,
    required Color color,
    double? height,
    double? letterSpacing,
    bool tabular = false,
  }) {
    return GoogleFonts.ibmPlexSans(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
      fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
    );
  }

  static TextStyle mono({
    double size = 12.5,
    FontWeight weight = FontWeight.w400,
    required Color color,
    double? height,
    double? letterSpacing,
    bool tabular = true,
  }) {
    return GoogleFonts.ibmPlexMono(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
      fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
    );
  }

  /// Column-header label style, e.g. "MARKET VALUE".
  static TextStyle columnLabel({required Color color}) => mono(
    size: 9.5,
    weight: FontWeight.w500,
    color: color,
    letterSpacing: 1.1,
    height: 1.3,
    tabular: false,
  );

  /// Section eyebrow label, e.g. "TOTAL VALUE".
  static TextStyle eyebrow({required Color color}) => mono(
    size: 9.5,
    weight: FontWeight.w500,
    color: color,
    letterSpacing: 1.05,
    height: 1,
    tabular: false,
  );
}

/// Builds the app-wide [ThemeData] for each brightness, wiring the
/// corresponding [LedgerPalette] in as a [ThemeExtension].
class LedgerTheme {
  LedgerTheme._();

  static ThemeData light() => _build(Brightness.light, LedgerPalette.light);

  static ThemeData dark() => _build(Brightness.dark, LedgerPalette.dark);

  static ThemeData _build(Brightness brightness, LedgerPalette palette) {
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: palette.surfacePage,
      colorScheme: ColorScheme.fromSeed(
        seedColor: palette.link,
        brightness: brightness,
      ),
      extensions: [palette],
    );
  }
}
