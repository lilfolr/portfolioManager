import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// App-wide theme mode (System / Light / Dark), persisted on-device.
///
/// Deliberately a plain [ValueNotifier] rather than a state-management
/// dependency the app doesn't otherwise have — a single global toggle
/// doesn't warrant pulling in Provider/Riverpod.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController() : super(ThemeMode.system);

  static const _prefsKey = 'themeMode';

  /// Loads the persisted mode, if any. Call once before `runApp`.
  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_prefsKey);
      value = switch (stored) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };
    } catch (_) {
      // Local storage unavailable (e.g. some test environments); fall back
      // to the System default already set by the initializer.
    }
  }

  Future<void> setMode(ThemeMode mode) async {
    value = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, mode.name);
    } catch (_) {
      // Best-effort persistence; the in-memory value is already updated.
    }
  }
}
