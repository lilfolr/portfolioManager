import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/ledger_theme.dart';

enum _Mode { signIn, signUp }

/// Email + password sign-in and sign-up. Shown by [AuthGate] whenever there
/// is no active session. Successful auth updates the Supabase session stream
/// directly — this screen does not navigate; [AuthGate] swaps it out.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  _Mode _mode = _Mode.signIn;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = Supabase.instance.client.auth;
      if (_mode == _Mode.signIn) {
        await auth.signInWithPassword(
          email: _email.text.trim(),
          password: _password.text,
        );
      } else {
        await auth.signUp(email: _email.text.trim(), password: _password.text);
      }
      // On success the auth state stream fires and AuthGate swaps screens.
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Something went wrong. Try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final isSignIn = _mode == _Mode.signIn;
    return Scaffold(
      backgroundColor: c.surfacePage,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: c.surfaceCard,
                border: Border.all(color: c.borderCard),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
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
                    const SizedBox(height: 20),
                    Text(
                      isSignIn ? 'Sign in' : 'Create account',
                      style: LedgerText.sans(
                        size: 18,
                        weight: FontWeight.w600,
                        color: c.textStrong,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isSignIn
                          ? 'Sign in to view your ledger.'
                          : 'Register to start a ledger.',
                      style: LedgerText.sans(size: 12.5, color: c.textMuted),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'EMAIL',
                      style: LedgerText.eyebrow(color: c.textFaint),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      style: LedgerText.sans(size: 13, color: c.textStrong),
                      decoration: _fieldDecoration(c, 'you@example.com'),
                      validator: (v) => (v == null || !v.contains('@'))
                          ? 'Enter a valid email'
                          : null,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'PASSWORD',
                      style: LedgerText.eyebrow(color: c.textFaint),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _password,
                      obscureText: true,
                      autofillHints: [
                        isSignIn
                            ? AutofillHints.password
                            : AutofillHints.newPassword,
                      ],
                      style: LedgerText.sans(size: 13, color: c.textStrong),
                      decoration: _fieldDecoration(c, '••••••••'),
                      validator: (v) => (v == null || v.length < 6)
                          ? 'At least 6 characters'
                          : null,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        style: LedgerText.sans(size: 12, color: c.negative),
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _loading ? null : _submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: c.ink,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: _loading
                            ? SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: c.surfacePage,
                                ),
                              )
                            : Text(
                                isSignIn ? 'Sign in' : 'Create account',
                                style: LedgerText.sans(
                                  size: 13,
                                  weight: FontWeight.w500,
                                  color: c.surfacePage,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: TextButton(
                        onPressed: _loading
                            ? null
                            : () => setState(() {
                                _mode = isSignIn ? _Mode.signUp : _Mode.signIn;
                                _error = null;
                              }),
                        child: Text(
                          isSignIn
                              ? "Don't have an account? Create one"
                              : 'Already have an account? Sign in',
                          style: LedgerText.sans(size: 12, color: c.link),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _fieldDecoration(LedgerPalette c, String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: LedgerText.sans(size: 13, color: c.textFaint),
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: BorderSide(color: c.borderControl),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: BorderSide(color: c.borderControl),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: BorderSide(color: c.link),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: BorderSide(color: c.negative),
      ),
    );
  }
}
