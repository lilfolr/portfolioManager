import 'package:flutter/material.dart';
import '../theme/ledger_theme.dart';

/// Small dot + label badge used for source-account tags and provenance
/// markers (e.g. "CommSec 0421", "CSV").
class SourceDotChip extends StatelessWidget {
  const SourceDotChip({
    super.key,
    required this.label,
    required this.dotColor,
    this.textColor = LedgerColors.textMid,
    this.dense = false,
  });

  final String label;
  final Color dotColor;
  final Color textColor;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(6, dense ? 1 : 2, 8, dense ? 1 : 2),
      decoration: BoxDecoration(
        color: LedgerColors.surfaceTable,
        border: Border.all(color: LedgerColors.borderSidebar),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: LedgerText.mono(
                size: dense ? 10.5 : 11,
                color: textColor,
                tabular: false,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A plain outlined tag with no dot, e.g. "ASX", "Unit trust · AMIT".
class PlainTag extends StatelessWidget {
  const PlainTag({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: LedgerColors.surfaceTable,
        border: Border.all(color: LedgerColors.borderSidebar),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: LedgerText.mono(
          size: 10.5,
          color: LedgerColors.textMid,
          tabular: false,
        ),
      ),
    );
  }
}

/// The "eligible" / "not yet" 12-month CGT-discount status pill, plus the
/// small held-since caption beneath it.
class HeldStatusPill extends StatelessWidget {
  const HeldStatusPill({
    super.key,
    required this.eligible,
    required this.heldDate,
  });

  final bool eligible;
  final String heldDate;

  @override
  Widget build(BuildContext context) {
    final fg = eligible
        ? LedgerColors.heldEligibleFg
        : LedgerColors.heldNotYetFg;
    final bg = eligible
        ? LedgerColors.heldEligibleBg
        : LedgerColors.heldNotYetBg;
    final border = eligible
        ? LedgerColors.heldEligibleBorder
        : LedgerColors.heldNotYetBorder;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(6, 2, 8, 2),
          decoration: BoxDecoration(
            color: bg,
            border: Border.all(color: border),
            borderRadius: BorderRadius.circular(4),
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 5,
                  height: 5,
                  decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Text(
                  eligible ? 'eligible' : 'not yet',
                  style: LedgerText.mono(size: 10.5, color: fg, tabular: false),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 3),
        Text(
          heldDate,
          style: LedgerText.mono(
            size: 10,
            color: LedgerColors.textFaint,
            tabular: false,
          ),
        ),
      ],
    );
  }
}
