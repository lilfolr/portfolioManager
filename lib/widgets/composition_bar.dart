import 'package:flutter/material.dart';
import '../theme/ledger_theme.dart';

/// One slice of the composition bar / legend.
class CompositionSegment {
  const CompositionSegment({
    required this.label,
    required this.fullLabel,
    required this.value,
    required this.color,
    required this.widthFraction,
    required this.pctLabel,
  });

  final String label;
  final String fullLabel;
  final double value;
  final Color color;
  final double widthFraction;
  final String pctLabel;
}

/// "COMPOSITION · SHARE OF MARKET VALUE" card: a segmented bar plus legend
/// row. Segments dim on hover (desktop) and toggle-select on tap (touch);
/// the caption swaps to the selected segment's detail either way.
class CompositionBar extends StatefulWidget {
  const CompositionBar({
    super.key,
    required this.segments,
    required this.byHolding,
    required this.byHoldingSelected,
    required this.byHoldingTap,
    required this.bySourceTap,
    required this.defaultCaption,
  });

  final List<CompositionSegment> segments;
  final bool byHolding;
  final bool byHoldingSelected;
  final VoidCallback byHoldingTap;
  final VoidCallback bySourceTap;
  final String defaultCaption;

  @override
  State<CompositionBar> createState() => _CompositionBarState();
}

class _CompositionBarState extends State<CompositionBar> {
  int? _active;

  void _select(int? i) => setState(() => _active = i);

  @override
  void didUpdateWidget(covariant CompositionBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Reset selection whenever the segment set changes (mode/filter toggle).
    if (oldWidget.segments.length != widget.segments.length) _active = null;
  }

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final active = _active != null && _active! < widget.segments.length
        ? widget.segments[_active!]
        : null;
    final caption = active == null
        ? widget.defaultCaption
        : '${active.fullLabel} · ${active.pctLabel} of value';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      decoration: BoxDecoration(
        border: Border.all(color: c.borderSubtle),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'COMPOSITION · SHARE OF MARKET VALUE',
                  style: LedgerText.eyebrow(color: c.textFaint),
                ),
              ),
              _modeButton(
                c,
                'by holding',
                widget.byHoldingSelected,
                widget.byHoldingTap,
              ),
              const SizedBox(width: 2),
              _modeButton(
                c,
                'by source account',
                !widget.byHoldingSelected,
                widget.bySourceTap,
              ),
            ],
          ),
          const SizedBox(height: 11),
          MouseRegion(
            onExit: (_) => _select(null),
            child: Row(
              children: [
                for (var i = 0; i < widget.segments.length; i++)
                  Expanded(
                    flex: (widget.segments[i].widthFraction * 10000)
                        .round()
                        .clamp(1, 1000000),
                    child: MouseRegion(
                      onEnter: (_) => _select(i),
                      child: GestureDetector(
                        onTap: () => _select(_active == i ? null : i),
                        child: Container(
                          height: 12,
                          margin: const EdgeInsets.only(right: 2),
                          decoration: BoxDecoration(
                            color: widget.segments[i].color,
                            borderRadius: BorderRadius.circular(2),
                          ),
                          child: Opacity(
                            opacity: _active == null || _active == i ? 1 : 0.32,
                            child: const SizedBox.expand(),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: 14,
                  runSpacing: 6,
                  children: [
                    for (var i = 0; i < widget.segments.length; i++)
                      Opacity(
                        opacity: _active == null || _active == i ? 1 : 0.32,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: widget.segments[i].color,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              widget.segments[i].label,
                              style: LedgerText.mono(
                                size: 11,
                                color: c.textStrong,
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              widget.segments[i].pctLabel,
                              style: LedgerText.mono(
                                size: 11,
                                color: c.textMid,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Text(
                caption,
                textAlign: TextAlign.right,
                style: LedgerText.mono(
                  size: 11,
                  color: c.textMuted,
                  height: 1.5,
                  tabular: false,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _modeButton(
    LedgerPalette c,
    String label,
    bool active,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
          decoration: BoxDecoration(
            color: active ? c.surfaceActive : c.surfaceCard,
            border: Border.all(color: c.borderSubtle),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            label,
            style: LedgerText.mono(size: 11, color: c.textMid, tabular: false),
          ),
        ),
      ),
    );
  }
}
