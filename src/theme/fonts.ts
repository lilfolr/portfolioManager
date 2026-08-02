import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';

/**
 * IBM Plex Sans / Mono, bundled rather than fetched at runtime as the Flutter
 * app's `google_fonts` did.
 *
 * The keys are the family names the Tailwind config maps `font-sans`,
 * `font-sans-med`, `font-mono` and friends onto. On native a weight is a
 * separate family, not a `fontWeight` value, which is why each weight is
 * loaded and named individually.
 */
export const ledgerFonts = {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};
