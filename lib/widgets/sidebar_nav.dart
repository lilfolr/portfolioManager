import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/ledger_theme.dart';

/// Fixed-width left sidebar: brand mark, portfolio nav, ledger-input nav,
/// and the user/footer block. Shown only at >=1000px; below that the
/// [MobileNavChips] row takes over.
class Sidebar extends StatelessWidget {
  const Sidebar({
    super.key,
    required this.onHoldings,
    required this.onDetail,
    required this.onOther,
    required this.isHoldings,
    required this.isDetail,
  });

  final VoidCallback onHoldings;
  final VoidCallback onDetail;
  final VoidCallback onOther;
  final bool isHoldings;
  final bool isDetail;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 226,
      decoration: const BoxDecoration(
        color: LedgerColors.surfaceSidebar,
        border: Border(right: BorderSide(color: LedgerColors.borderSidebar)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: LedgerColors.ink,
                    borderRadius: BorderRadius.circular(5),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    'L',
                    style: LedgerText.mono(
                      size: 11,
                      weight: FontWeight.w500,
                      color: LedgerColors.surfacePage,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  'Ledger',
                  style: LedgerText.sans(
                    size: 13,
                    weight: FontWeight.w600,
                    letterSpacing: -0.13,
                  ),
                ),
              ],
            ),
          ),
          const _SidebarLabel('PORTFOLIO'),
          _NavItem(
            label: 'Holdings',
            selected: isHoldings,
            onTap: onHoldings,
            bold: true,
          ),
          _NavItem(
            label: 'holding detail',
            symbol: 'VAS',
            selected: isDetail,
            onTap: onDetail,
            indent: true,
          ),
          _NavItem(label: 'Income summary', selected: false, onTap: onOther),
          _NavItem(label: 'Capital gains', selected: false, onTap: onOther),
          _NavItem(label: 'Property', selected: false, onTap: onOther),
          const _SidebarLabel('LEDGER INPUT'),
          _NavItem(
            label: 'Import review',
            selected: false,
            onTap: onOther,
            badge: '7',
          ),
          _NavItem(label: 'Import sources', selected: false, onTap: onOther),
          _NavItem(label: 'Transaction entry', selected: false, onTap: onOther),
          const Spacer(),
          const _UserFooter(),
        ],
      ),
    );
  }
}

class _SidebarLabel extends StatelessWidget {
  const _SidebarLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
      child: Text(text, style: LedgerText.eyebrow()),
    );
  }
}

/// Signed-in user block: avatar initials + email derived from the Supabase
/// session, plus sign-out. Replaces the previous hardcoded 'JD' / 'J. Devlin'
/// placeholder.
class _UserFooter extends StatelessWidget {
  const _UserFooter();

  String _initials(String email) {
    final local = email.split('@').first;
    if (local.isEmpty) return '?';
    return local.length == 1
        ? local.toUpperCase()
        : local.substring(0, 2).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    // Guard against Supabase not being initialized: widget tests pump
    // [LedgerAppShell] directly (see test/widget_test.dart) without running
    // main()'s Supabase.initialize(), so this must degrade gracefully rather
    // than throw.
    String email = 'signed in';
    try {
      email = Supabase.instance.client.auth.currentUser?.email ?? email;
    } catch (_) {
      // Not initialized (e.g. under test) — keep the fallback label.
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: LedgerColors.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: const Color(0xFFE7E3D9),
                  border: Border.all(color: const Color(0xFFDCD7CB)),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  _initials(email),
                  style: LedgerText.mono(
                    size: 9.5,
                    weight: FontWeight.w500,
                    color: LedgerColors.textMid,
                    tabular: false,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  email,
                  overflow: TextOverflow.ellipsis,
                  style: LedgerText.sans(size: 12, color: LedgerColors.textMid),
                ),
              ),
              GestureDetector(
                onTap: () {
                  try {
                    Supabase.instance.client.auth.signOut();
                  } catch (_) {
                    // Not initialized (e.g. under test) — no-op.
                  }
                },
                child: Text(
                  'Sign out',
                  style: LedgerText.sans(size: 11.5, color: LedgerColors.link),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'All amounts AUD\nLedger current to 01 Aug 2026',
            style: LedgerText.mono(
              size: 10,
              color: LedgerColors.textFaint,
              height: 1.5,
              tabular: false,
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatefulWidget {
  const _NavItem({
    required this.label,
    required this.selected,
    required this.onTap,
    this.symbol,
    this.badge,
    this.bold = false,
    this.indent = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? symbol;
  final String? badge;
  final bool bold;
  final bool indent;

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: Container(
          color: _hover ? const Color(0xFFF1EFE9) : Colors.transparent,
          padding: EdgeInsets.fromLTRB(
            widget.indent ? 30 : 18,
            widget.indent ? 7 : 8,
            18,
            widget.indent ? 7 : 8,
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              if (widget.selected)
                Positioned(
                  left: widget.indent ? -12 : 0,
                  top: 0,
                  bottom: 0,
                  child: Container(width: 2, color: LedgerColors.link),
                ),
              Row(
                children: [
                  if (widget.symbol != null) ...[
                    Text(
                      widget.symbol!,
                      style: LedgerText.mono(
                        size: 11.5,
                        color: LedgerColors.textStrong,
                      ),
                    ),
                    const SizedBox(width: 9),
                    Flexible(
                      child: Text(
                        widget.label,
                        overflow: TextOverflow.ellipsis,
                        style: LedgerText.sans(
                          size: 12.5,
                          color: LedgerColors.textMuted,
                          tabular: false,
                        ),
                      ),
                    ),
                  ] else
                    Expanded(
                      child: Text(
                        widget.label,
                        style: LedgerText.sans(
                          size: 13,
                          weight: widget.bold
                              ? FontWeight.w500
                              : FontWeight.w400,
                          color: LedgerColors.textStrong,
                          tabular: false,
                        ),
                      ),
                    ),
                  if (widget.badge != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE9EAF2),
                        border: Border.all(color: const Color(0xFFD3D7E6)),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Text(
                        widget.badge!,
                        style: LedgerText.mono(
                          size: 10,
                          weight: FontWeight.w500,
                          color: LedgerColors.link,
                          height: 1.5,
                          tabular: false,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Horizontal chip row shown in place of the sidebar below 1000px.
class MobileNavChips extends StatelessWidget {
  const MobileNavChips({
    super.key,
    required this.onHoldings,
    required this.onDetail,
    required this.onOther,
  });

  final VoidCallback onHoldings;
  final VoidCallback onDetail;
  final VoidCallback onOther;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: LedgerColors.surfaceSidebar,
        border: Border(bottom: BorderSide(color: LedgerColors.borderSidebar)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _chip('Holdings', onHoldings, bold: true),
            const SizedBox(width: 6),
            _chip('VAS detail', onDetail),
            const SizedBox(width: 6),
            _chip('Income', onOther, muted: true),
            const SizedBox(width: 6),
            _chip('Review · 7', onOther, muted: true),
          ],
        ),
      ),
    );
  }

  Widget _chip(
    String label,
    VoidCallback onTap, {
    bool bold = false,
    bool muted = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: LedgerColors.borderButton),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(
          label,
          style: LedgerText.sans(
            size: 12,
            weight: bold ? FontWeight.w500 : FontWeight.w400,
            color: muted ? LedgerColors.textMid : LedgerColors.textStrong,
          ),
        ),
      ),
    );
  }
}
