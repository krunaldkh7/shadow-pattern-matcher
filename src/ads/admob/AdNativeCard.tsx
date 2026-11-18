import { useEffect, useState } from 'react';
import { AdBanner } from './AdBanner';
import { Image, StyleSheet, Text, View } from 'react-native';
import { FONT, INK } from '../../ui/theme';
import { useAdConfig } from '../adConfig';
import { nativeModule, nativeUnitId, skipNextAppOpen } from './admobAds';

type NativeAdInstance = import('react-native-google-mobile-ads').NativeAd;

/**
 * A native ad styled like the gallery cards around it, with a clear "Ad"
 * label. Renders nothing until an ad has loaded (or at all when ads are off).
 * With no native unit configured, the slot shows a banner card instead.
 */
export function AdNativeCard() {
  const config = useAdConfig();
  const unitId = nativeUnitId(config);
  const native = nativeModule();
  const [ad, setAd] = useState<NativeAdInstance | null>(null);

  useEffect(() => {
    if (!unitId || !native) return;
    let alive = true;
    let loaded: NativeAdInstance | null = null;
    // Each attempt is a fresh request; a failure retries in 30 s so the slot isn't empty for good.
    let retry: ReturnType<typeof setTimeout> | undefined;
    const request = () =>
      native.NativeAd.createForAdRequest(unitId)
        .then((a) => {
          loaded = a;
          // A click opens the advertiser outside the app; returning shouldn't trigger an app-open ad.
          a.addAdEventListener(native.NativeAdEventType.CLICKED, skipNextAppOpen);
          if (alive) setAd(a);
          else a.destroy();
        })
        .catch((e) => {
          if (__DEV__) console.log('[ads] native failed to load', e);
          if (alive) retry = setTimeout(request, 30_000);
        });
    request();
    return () => {
      alive = false;
      clearTimeout(retry);
      loaded?.destroy();
    };
  }, [unitId, native]);

  if (!unitId) return <AdBanner placement="card" />;
  if (!ad || !native) return null;
  const { NativeAdView, NativeAsset, NativeAssetType } = native;

  return (
    <NativeAdView nativeAd={ad} style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Ad</Text>
      </View>
      {ad.icon ? (
        <NativeAsset assetType={NativeAssetType.ICON}>
          <Image source={{ uri: ad.icon.url }} style={styles.icon} />
        </NativeAsset>
      ) : null}
      <View style={styles.body}>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text style={styles.headline} numberOfLines={1}>
            {ad.headline}
          </Text>
        </NativeAsset>
        {ad.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.text} numberOfLines={2}>
              {ad.body}
            </Text>
          </NativeAsset>
        ) : null}
      </View>
      {ad.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={styles.cta}>{ad.callToAction}</Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingTop: 22,
    borderRadius: 4,
    backgroundColor: INK.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.paperEdge,
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 10,
    paddingHorizontal: 5,
    borderRadius: 2,
    backgroundColor: INK.brass,
  },
  badgeText: { fontFamily: FONT.label, fontSize: 10, color: INK.paper },
  icon: { width: 46, height: 46, borderRadius: 8 },
  body: { flex: 1, gap: 2 },
  headline: { fontFamily: FONT.title, fontSize: 16, color: INK.ink },
  text: { fontFamily: FONT.body, fontSize: 13, color: INK.inkSoft },
  cta: {
    fontFamily: FONT.label,
    fontSize: 13,
    color: INK.paper,
    backgroundColor: INK.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
