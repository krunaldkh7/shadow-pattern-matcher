/**
 * Store-required links. The App Store needs a privacy policy and a support
 * URL; Google Play needs a privacy policy (AdMob requires one too). The pages
 * are on the developer's blog, so they can be edited without an app release.
 * app-ads.txt for AdMob lives separately on https://krunaldkh7.github.io.
 */
const BLOG = 'https://coresyncro.blogspot.com/2026/10';

export const LEGAL_LINKS = {
  privacyPolicy: `${BLOG}/privacy-policy-shadow-pattern-matcher.html`,
  termsOfUse: `${BLOG}/terms-of-use-shadow-pattern-matcher.html`,
  support: `${BLOG}/support-shadow-pattern-matcher.html`,
  supportEmail: 'krunaldudhagara7777@gmail.com',
};
