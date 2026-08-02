import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'auth/auth_gate.dart';
import 'supabase_config.dart';
import 'theme/ledger_theme.dart';
import 'theme/theme_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: SupabaseConfig.url,
    // `publishableKey` is the current param name; the value is still the
    // legacy anon JWT that `make db-status` / `supabase status` prints for
    // self-hosted local stacks.
    publishableKey: SupabaseConfig.anonKey,
  );
  final themeController = ThemeController();
  await themeController.load();
  runApp(MyApp(themeController: themeController));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key, required this.themeController});

  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeController,
      builder: (context, mode, _) {
        return MaterialApp(
          title: 'Ledger',
          debugShowCheckedModeBanner: false,
          theme: LedgerTheme.light(),
          darkTheme: LedgerTheme.dark(),
          themeMode: mode,
          home: AuthGate(themeController: themeController),
        );
      },
    );
  }
}
