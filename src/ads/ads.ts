/**
 * The ad network the app uses. Every screen imports ads from here, never from
 * a network folder, so switching networks is a one-line change here plus the
 * matching line in AdBanner.tsx, the config plugin in app.json and
 * adsConfigUrl. AdMob is live; the Unity LevelPlay version is kept in ./unity
 * (unused, and not linked into the native app) in case it's needed again.
 */
export * from './admob/admobAds';
