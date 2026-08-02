import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../app_shell.dart';
import '../theme/theme_controller.dart';
import 'login_screen.dart';

/// Shows [LoginScreen] until there is a Supabase session, then [LedgerAppShell].
///
/// Seeds the stream with the current session as `initialData` so a restored
/// session (e.g. on page reload for web) renders the app immediately instead
/// of flashing the login screen first.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key, required this.themeController});

  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      initialData: AuthState(
        AuthChangeEvent.initialSession,
        auth.currentSession,
      ),
      builder: (context, snapshot) {
        final session = snapshot.data?.session ?? auth.currentSession;
        return session == null
            ? const LoginScreen()
            : LedgerAppShell(themeController: themeController);
      },
    );
  }
}
