/**
 * Unity LevelPlay stays installed so the kept Unity code (src/ads/unity)
 * still type-checks, but its native SDK is not linked into the app while
 * AdMob is the active network. To switch back to Unity, delete this entry and
 * follow the note in src/ads/ads.ts.
 */
module.exports = {
  dependencies: {
    'unity-levelplay-mediation': { platforms: { ios: null, android: null } },
  },
};
