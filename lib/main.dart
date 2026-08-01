import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'auth/auth_gate.dart';
import 'supabase_config.dart';
import 'theme/ledger_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: SupabaseConfig.url,
    // `publishableKey` is the current param name; the value is still the
    // legacy anon JWT that `make db-status` / `supabase status` prints for
    // self-hosted local stacks.
    publishableKey: SupabaseConfig.anonKey,
  );
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ledger',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: LedgerColors.white,
        colorScheme: ColorScheme.fromSeed(seedColor: LedgerColors.link),
      ),
      home: const AuthGate(),
    );
  }
}
