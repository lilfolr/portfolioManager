import 'package:flutter/material.dart';
import '../theme/ledger_theme.dart';

/// Placeholder shown for the five nav items not covered by this hi-fi pass
/// (Income summary, Capital gains, Property, Import review/sources,
/// Transaction entry).
class NotInPassScreen extends StatelessWidget {
  const NotInPassScreen({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 80),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Not in this pass',
                textAlign: TextAlign.center,
                style: LedgerText.sans(
                  size: 13,
                  weight: FontWeight.w500,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'This hi-fi pass covers the holdings dashboard and holding detail. The other seven screens exist as wireframes.',
                textAlign: TextAlign.center,
                style: LedgerText.sans(
                  size: 12,
                  color: LedgerColors.textMid,
                  height: 1.6,
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: onBack,
                child: Container(
                  height: 32,
                  padding: const EdgeInsets.symmetric(horizontal: 13),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: LedgerColors.borderButton),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text(
                    'Back to holdings',
                    style: LedgerText.sans(size: 12.5),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
