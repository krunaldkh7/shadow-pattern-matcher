const { withAppBuildGradle, withDangerousMod, withInfoPlist } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Native setup for Unity LevelPlay with Unity Ads as its only network.
 * unity-levelplay-mediation ships the LevelPlay SDK but no config plugin and
 * no network adapters, so this adds:
 *  • the Unity Ads adapter pod (iOS) and Gradle dependency (Android),
 *  • the SKAdNetwork IDs for LevelPlay and Unity Ads, plus SKAN postbacks
 *    (unityAdsSkAdNetworkIds.json is Unity's official list, saved from
 *    https://skan.mz.unity3d.com/v3/partner/skadnetworks.plist.json; refresh it now and then),
 *  • the Google advertising-ID libraries LevelPlay needs on Android.
 * Bump the adapter versions together with the plugin, following
 * https://docs.unity.com/en-us/grow/levelplay/sdk/react/mediation-networks
 */

const IOS_ADAPTER_POD = "pod 'IronSourceUnityAdsAdapter', '5.13.0.0'";
const ANDROID_DEPS = [
  "implementation 'com.unity3d.ads-mediation:unityads-adapter:5.16.0'",
  "implementation 'com.google.android.gms:play-services-ads-identifier:18.0.1'",
  "implementation 'com.google.android.gms:play-services-appset:16.0.2'",
];
const SKAD_NETWORK_IDS = [
  'su67r6k2v3.skadnetwork', // LevelPlay
  ...require('./unityAdsSkAdNetworkIds.json'),
];
const MARKER = '# withUnityAds';

const withAdapterPod = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        contents = contents.replace(/(use_expo_modules!\s*\n)/, `$1  ${MARKER}\n  ${IOS_ADAPTER_POD}\n`);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);

const withSkAdNetwork = (config) =>
  withInfoPlist(config, (cfg) => {
    const items = cfg.modResults.SKAdNetworkItems ?? [];
    const have = new Set(items.map((i) => i.SKAdNetworkIdentifier?.toLowerCase()));
    for (const id of SKAD_NETWORK_IDS) if (!have.has(id)) items.push({ SKAdNetworkIdentifier: id });
    cfg.modResults.SKAdNetworkItems = items;
    cfg.modResults.NSAdvertisingAttributionReportEndpoint = 'https://postbacks-is.com';
    return cfg;
  });

const withAndroidDeps = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes('unityads-adapter')) {
      gradle = gradle.replace(/dependencies\s*\{/, (m) => `${m}\n    ${ANDROID_DEPS.join('\n    ')}`);
      cfg.modResults.contents = gradle;
    }
    return cfg;
  });

module.exports = (config) => withAndroidDeps(withSkAdNetwork(withAdapterPod(config)));
