import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/ledger_theme.dart';
import '../theme/theme_controller.dart';

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
    required this.themeController,
  });

  final VoidCallback onHoldings;
  final VoidCallback onDetail;
  final VoidCallback onOther;
  final bool isHoldings;
  final bool isDetail;
  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return Container(
      width: 226,
      decoration: BoxDecoration(
        color: c.surfaceSidebar,
        border: Border(right: BorderSide(color: c.borderSidebar)),
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
                    color: c.ink,
                    borderRadius: BorderRadius.circular(5),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    'L',
                    style: LedgerText.mono(
                      size: 11,
                      weight: FontWeight.w500,
                      color: c.surfacePage,
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
                    color: c.textStrong,
                  ),
                ),
              ],
            ),
          ),
          _SidebarLabel('PORTFOLIO'),
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
          _SidebarLabel('LEDGER INPUT'),
          _NavItem(
            label: 'Import review',
            selected: false,
            onTap: onOther,
            badge: '7',
          ),
          _NavItem(label: 'Import sources', selected: false, onTap: onOther),
          _NavItem(label: 'Transaction entry', selected: false, onTap: onOther),
          const Spacer(),
          _UserFooter(themeController: themeController),
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
    final c = LedgerColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
      child: Text(text, style: LedgerText.eyebrow(color: c.textFaint)),
    );
  }
}

/// Signed-in user block: avatar initials + email derived from the Supabase
/// session, plus sign-out and the theme mode switcher.
class _UserFooter extends StatelessWidget {
  const _UserFooter({required this.themeController});

  final ThemeController themeController;

  String _initials(String email) {
    final local = email.split('@').first;
    if (local.isEmpty) return '?';
    return local.length == 1
        ? local.toUpperCase()
        : local.substring(0, 2).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
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
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: c.borderSubtle)),
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
                  color: c.avatarBg,
                  border: Border.all(color: c.avatarBorder),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  _initials(email),
                  style: LedgerText.mono(
                    size: 9.5,
                    weight: FontWeight.w500,
                    color: c.textMid,
                    tabular: false,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  email,
                  overflow: TextOverflow.ellipsis,
                  style: LedgerText.sans(size: 12, color: c.textMid),
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
                  style: LedgerText.sans(size: 11.5, color: c.link),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _ThemeModeSwitcher(themeController: themeController),
          const SizedBox(height: 10),
          Text(
            'All amounts AUD\nLedger current to 01 Aug 2026',
            style: LedgerText.mono(
              size: 10,
              color: c.textFaint,
              height: 1.5,
              tabular: false,
            ),
          ),
        ],
      ),
    );
  }
}

/// Three-way System / Light / Dark control, styled as a small segmented row
/// to match the sidebar's other controls.
class _ThemeModeSwitcher extends StatelessWidget {
  const _ThemeModeSwitcher({required this.themeController});

  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeController,
      builder: (context, mode, _) {
        return Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: c.surfaceHover,
            border: Border.all(color: c.borderControl),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            children: [
              _modeButton(context, c, ThemeMode.system, 'System', mode),
              _modeButton(context, c, ThemeMode.light, 'Light', mode),
              _modeButton(context, c, ThemeMode.dark, 'Dark', mode),
            ],
          ),
        );
      },
    );
  }

  Widget _modeButton(
    BuildContext context,
    LedgerPalette c,
    ThemeMode value,
    String label,
    ThemeMode active,
  ) {
    final selected = value == active;
    return Expanded(
      child: GestureDetector(
        onTap: () => themeController.setMode(value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 4),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? c.surfaceCard : Colors.transparent,
            border: selected ? Border.all(color: c.borderButton) : null,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            label,
            style: LedgerText.sans(
              size: 10.5,
              weight: selected ? FontWeight.w500 : FontWeight.w400,
              color: selected ? c.textStrong : c.textMuted,
              tabular: false,
            ),
          ),
        ),
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
    final c = LedgerColors.of(context);
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: Container(
          color: _hover ? c.surfaceHover : Colors.transparent,
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
                  child: Container(width: 2, color: c.link),
                ),
              Row(
                children: [
                  if (widget.symbol != null) ...[
                    Text(
                      widget.symbol!,
                      style: LedgerText.mono(size: 11.5, color: c.textStrong),
                    ),
                    const SizedBox(width: 9),
                    Flexible(
                      child: Text(
                        widget.label,
                        overflow: TextOverflow.ellipsis,
                        style: LedgerText.sans(
                          size: 12.5,
                          color: c.textMuted,
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
                          color: c.textStrong,
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
                        color: c.badgeBg,
                        border: Border.all(color: c.badgeBorder),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Text(
                        widget.badge!,
                        style: LedgerText.mono(
                          size: 10,
                          weight: FontWeight.w500,
                          color: c.link,
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
    final c = LedgerColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: c.surfaceSidebar,
        border: Border(bottom: BorderSide(color: c.borderSidebar)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _chip(c, 'Holdings', onHoldings, bold: true),
            const SizedBox(width: 6),
            _chip(c, 'VAS detail', onDetail),
            const SizedBox(width: 6),
            _chip(c, 'Income', onOther, muted: true),
            const SizedBox(width: 6),
            _chip(c, 'Review · 7', onOther, muted: true),
          ],
        ),
      ),
    );
  }

  Widget _chip(
    LedgerPalette c,
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
          color: c.surfaceCard,
          border: Border.all(color: c.borderButton),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(
          label,
          style: LedgerText.sans(
            size: 12,
            weight: bold ? FontWeight.w500 : FontWeight.w400,
            color: muted ? c.textMid : c.textStrong,
          ),
        ),
      ),
    );
  }
}
