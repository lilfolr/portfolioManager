import 'package:flutter/material.dart';
import '../theme/ledger_theme.dart';

/// Breadcrumb + search box + FY selector strip above the screen content.
class TopBar extends StatelessWidget {
  const TopBar({
    super.key,
    required this.crumb,
    required this.fy,
    required this.onFyChanged,
    required this.showSearch,
    required this.horizontalPadding,
  });

  final String crumb;
  final String fy;
  final ValueChanged<String> onFyChanged;
  final bool showSearch;
  final double horizontalPadding;

  static const _fyOptions = ['FY 2025–26', 'FY 2024–25', 'FY 2023–24'];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: horizontalPadding, vertical: 10),
      decoration: const BoxDecoration(
        color: LedgerColors.surfaceTopBar,
        border: Border(bottom: BorderSide(color: LedgerColors.borderSubtle)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              crumb,
              overflow: TextOverflow.ellipsis,
              style: LedgerText.mono(size: 11.5, color: LedgerColors.textMuted, height: 1.3, tabular: false),
            ),
          ),
          if (showSearch) ...[
            Container(
              width: 230,
              height: 28,
              padding: const EdgeInsets.symmetric(horizontal: 9),
              decoration: BoxDecoration(
                border: Border.all(color: LedgerColors.borderControl),
                borderRadius: BorderRadius.circular(5),
              ),
              child: Row(
                children: [
                  Container(
                    width: 9,
                    height: 9,
                    decoration: BoxDecoration(
                      border: Border.all(color: LedgerColors.textFaint, width: 1.5),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      'Search symbol, parcel, txn id',
                      overflow: TextOverflow.ellipsis,
                      style: LedgerText.sans(size: 12, color: LedgerColors.textFaint),
                    ),
                  ),
                  Text('/', style: LedgerText.mono(size: 10, color: const Color(0xFFBDB7A9), tabular: false)),
                ],
              ),
            ),
            const SizedBox(width: 8),
          ],
          Container(
            height: 28,
            padding: const EdgeInsets.symmetric(horizontal: 6),
            decoration: BoxDecoration(
              border: Border.all(color: LedgerColors.borderControl),
              borderRadius: BorderRadius.circular(5),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: fy,
                isDense: true,
                icon: const SizedBox.shrink(),
                style: LedgerText.mono(size: 12, color: LedgerColors.textStrong),
                items: _fyOptions.map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
                onChanged: (v) {
                  if (v != null) onFyChanged(v);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
