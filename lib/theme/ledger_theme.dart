import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Palette and text styles for the Holdings ledger UI, ported 1:1 from the
/// `Holdings Hi-Fi.dc.html` design. Keep every literal here rather than
/// scattered through widgets so the design stays a single source of truth.
class LedgerColors {
  LedgerColors._();

  // Ink / text.
  static const ink = Color(0xFF1A1916);
  static const textStrong = Color(0xFF3D3A33);
  static const textMid = Color(0xFF57534A);
  static const textMuted = Color(0xFF8A8479);
  static const textFaint = Color(0xFFA09A8D);

  // Link / accent.
  static const link = Color(0xFF3A5A8C);
  static const linkHover = Color(0xFF28406A);

  // Gain / loss.
  static const positive = Color(0xFF2F6A4A);
  static const negative = Color(0xFF8F4A37);

  // Surfaces.
  static const surfaceSidebar = Color(0xFFFBFAF7);
  static const surfaceTable = Color(0xFFFAF9F6);
  static const surfaceTopBar = Color(0xFFFDFCFA);
  static const surfaceActive = Color(0xFFF0EEE8);
  static const surfaceGroupHead = Color(0xFFF4F2EC);
  static const surfaceParcelTint = Color(0xFFFDFCF9);
  static const surfaceInfoBox = Color(0xFFF7F8FC);
  static const surfaceWarnBox = Color(0xFFFDFAF1);
  static const surfacePage = Color(0xFFF4F2ED);
  static const white = Color(0xFFFFFFFF);

  // Borders.
  static const borderCard = Color(0xFFDFDBD1);
  static const borderSidebar = Color(0xFFE4E0D7);
  static const borderSubtle = Color(0xFFE9E5DC);
  static const borderRow = Color(0xFFF0ECE3);
  static const borderHeaderRule = Color(0xFFDDD8CD);
  static const borderControl = Color(0xFFE0DBD1);
  static const borderControlHover = Color(0xFFC9C2B4);
  static const borderButton = Color(0xFFDCD7CB);
  static const borderTotalRule = Color(0xFFCFC8B9);
  static const borderInfoBox = Color(0xFFE2E5EE);
  static const borderWarnBox = Color(0xFFE9E2CF);

  // Held-status pill.
  static const heldEligibleFg = Color(0xFF2F6A4A);
  static const heldEligibleBg = Color(0xFFF4F8F5);
  static const heldEligibleBorder = Color(0xFFDDE8E0);
  static const heldNotYetFg = Color(0xFF8A6A3A);
  static const heldNotYetBg = Color(0xFFFDFAF1);
  static const heldNotYetBorder = Color(0xFFE9E2CF);
  static const pendingAmber = Color(0xFFA8894A);
  static const pendingText = Color(0xFF7A6F57);

  /// Composition-bar ramp, used when segmenting "by holding".
  static const compRamp = [
    Color(0xFF2F4A75),
    Color(0xFF3A5A8C),
    Color(0xFF4A6B9C),
    Color(0xFF5C7CAD),
    Color(0xFF7089B9),
    Color(0xFF8497C4),
    Color(0xFF99A7CF),
    Color(0xFFADB7D9),
    Color(0xFFC2C8E3),
  ];

  /// Source-account dot colours, keyed by the same source strings used in
  /// the sample data.
  static const sourceDots = <String, Color>{
    'CommSec 0421': Color(0xFF3A5A8C),
    'Stake AU': Color(0xFF4A6F6A),
    'Stake US': Color(0xFF4A6F6A),
    'Computershare · SRN': Color(0xFF7A6F57),
    'MUFG · SRN': Color(0xFF8A6A7A),
  };

  static Color sourceDot(String source) => sourceDots[source] ?? textFaint;
}

/// Text style helpers. Every style used on a numeric/figure cell must carry
/// [FontFeature.tabularFigures] so columns stay aligned — the design relies
/// on `font-variant-numeric:tabular-nums` almost everywhere numbers appear.
class LedgerText {
  LedgerText._();

  static TextStyle sans({
    double size = 13,
    FontWeight weight = FontWeight.w400,
    Color color = LedgerColors.textStrong,
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
    Color color = LedgerColors.textStrong,
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
  static TextStyle columnLabel({Color color = LedgerColors.textMuted}) => mono(
    size: 9.5,
    weight: FontWeight.w500,
    color: color,
    letterSpacing: 1.1,
    height: 1.3,
    tabular: false,
  );

  /// Section eyebrow label, e.g. "TOTAL VALUE".
  static TextStyle eyebrow({Color color = LedgerColors.textFaint}) => mono(
    size: 9.5,
    weight: FontWeight.w500,
    color: color,
    letterSpacing: 1.05,
    height: 1,
    tabular: false,
  );
}
