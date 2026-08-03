// The profile registry.
//
// Adding a source is: write the profile beside native.ts, add it to PROFILES,
// write its cases in map_test.ts. Nothing else in the import path is aware of
// how many profiles exist.

import { assertValidTimeZone } from "../coerce.ts";
import type { ImportProfile } from "../types.ts";
import { nativeProfile } from "./native.ts";

export const PROFILES: readonly ImportProfile[] = [nativeProfile];

// A typo in an IANA zone would otherwise surface as every date in an import
// being silently a day out. Fail at module load instead.
for (const profile of PROFILES) assertValidTimeZone(profile.sourceTimeZone);

export function profileById(id: string): ImportProfile | undefined {
  return PROFILES.find((profile) => profile.id === id);
}

export interface ProfileMatch {
  profile: ImportProfile;
  confidence: number;
}

/**
 * Ranks every profile against the file's headers, best first.
 *
 * Detection only ever *suggests*: the start screen shows the pick and lets the
 * user override it before anything is staged. Which parser ran is recorded in
 * parser_version either way, so a wrong guess is diagnosable after the fact
 * rather than invisible.
 */
export function rankProfiles(headers: string[]): ProfileMatch[] {
  return PROFILES.map((profile) => ({
    profile,
    confidence: profile.detect(headers),
  }))
    .filter((match) => match.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);
}

export function detectProfile(headers: string[]): ImportProfile | undefined {
  return rankProfiles(headers)[0]?.profile;
}

/** `{id}@{version}` — what goes in import_sources.parser_version. */
export function parserVersion(profile: ImportProfile): string {
  return `${profile.id}@${profile.version}`;
}

export { nativeProfile };
