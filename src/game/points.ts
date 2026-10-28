/**
 * Points for a solved gallery level, the currency of the leaderboard:
 *   100 for solving + 50 per bulb kept (stars) + up to 60 for speed (1 per second under a minute).
 * Skipped levels and the player's own levels earn nothing, so points can't be farmed.
 */
export const BASE_POINTS = 100;
export const POINTS_PER_BULB = 50;
export const SPEED_BONUS_SECONDS = 60;

/** The most one level can be worth: 3 bulbs, solved instantly. */
export const MAX_POINTS_PER_LEVEL = BASE_POINTS + POINTS_PER_BULB * 3 + SPEED_BONUS_SECONDS;

export function pointsFor(stars: number, seconds: number) {
  const speed = Math.max(0, SPEED_BONUS_SECONDS - Math.max(0, Math.round(seconds)));
  return BASE_POINTS + POINTS_PER_BULB * Math.max(0, Math.min(3, stars)) + speed;
}
