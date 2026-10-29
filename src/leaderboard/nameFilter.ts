/**
 * Leaderboard names are public, so block obvious profanity, slurs and contact
 * details before a name is saved. Matching runs on a normalised copy (lower
 * case, common look-alike digits and symbols mapped back to letters, separators
 * removed) so "f.u_c k" or "sh1t" are caught too.
 */

// Kept short and deliberately blunt; extend as reports come in.
const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard',
  'whore', 'slut', 'porn', 'sexy', 'nude', 'rape', 'penis', 'vagina', 'boob',
  'nigger', 'nigga', 'faggot', 'retard', 'chink', 'kike',
  'hitler', 'nazi', 'isis', 'suicide',
  'chutiya', 'chutia', 'chotiya', 'madarchod', 'bhenchod', 'behenchod', 'bhosdi', 'gandu',
  'randi', 'lauda', 'lavda', 'harami', 'kutta',
  'admin', 'moderator', 'official', 'apple', 'google',
];

const LOOKALIKE: Record<string, string> = {
  '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a',
  '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g',
};

function normalise(name: string) {
  return name
    .toLowerCase()
    .replace(/[0-9!|@$]/g, (c) => LOOKALIKE[c] ?? c)
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');
}

export type NameProblem = 'short' | 'blocked' | 'contact';

/** Why a leaderboard name can't be used, or null when it's fine. */
export function nameProblem(raw: string): NameProblem | null {
  const name = raw.trim();
  if (name.length < 2) return 'short';
  // No emails, links, handles or phone numbers.
  if (/[@]|https?:|www\.|\.(com|net|in|org)\b|\d{6,}/i.test(name.replace(/\s/g, ''))) return 'contact';
  const flat = normalise(name);
  if (BLOCKED.some((w) => flat.includes(w.replace(/(.)\1+/g, '$1')))) return 'blocked';
  return null;
}
