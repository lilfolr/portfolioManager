/// Supabase connection details, injected at build/run time via
/// `--dart-define-from-file` (see `Makefile`'s `ENV_FILE` var and
/// `env/local.example.json`).
///
/// `String.fromEnvironment` only reads a `--dart-define` value when used in
/// a `const` context — keep these `static const`, not plain fields, or the
/// values silently resolve to `''`.
class SupabaseConfig {
  SupabaseConfig._();

  static const url = String.fromEnvironment('SUPABASE_URL');
  static const anonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
}
