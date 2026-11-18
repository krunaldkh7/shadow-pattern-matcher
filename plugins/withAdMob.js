const { withInfoPlist } = require('expo/config-plugins');

/**
 * Extra native setup for AdMob on top of react-native-google-mobile-ads'
 * own plugin (which sets the App IDs and the tracking text):
 *  • Google's SKAdNetwork IDs for AdMob and its third-party buyers.
 *    admobSkAdNetworkIds.json is saved from
 *    https://developers.google.com/admob/ios/3p-skadnetworks; refresh it now and then.
 */
const SKAD_NETWORK_IDS = require('./admobSkAdNetworkIds.json');

module.exports = (config) =>
  withInfoPlist(config, (cfg) => {
    const items = cfg.modResults.SKAdNetworkItems ?? [];
    const have = new Set(items.map((i) => i.SKAdNetworkIdentifier?.toLowerCase()));
    for (const id of SKAD_NETWORK_IDS) if (!have.has(id)) items.push({ SKAdNetworkIdentifier: id });
    cfg.modResults.SKAdNetworkItems = items;
    return cfg;
  });
