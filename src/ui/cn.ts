import { twMerge } from 'tailwind-merge';

/**
 * Merge class strings, letting a caller's class beat a component's default.
 *
 * Necessary because class order in the string means nothing -- NativeWind
 * resolves classes through real CSS specificity, so between two same-property
 * utilities the winner is whichever Tailwind emitted later, which is
 * effectively arbitrary. `twMerge` drops the loser instead.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
