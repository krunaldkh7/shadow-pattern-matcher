import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LevelPlayBannerAdViewMethods } from 'unity-levelplay-mediation';
import { FONT, INK } from '../ui/theme';
import { useAdConfig } from './adConfig';
import { bannerComponent, bannerUnitId, skipNextReturnAd, type BannerPlacement } from './unityAds';

/** After a failed load, try a fresh banner this much later. */
const RETRY_MS = 30_000;

/**
 * Banner ad: the bottom strip by default, or set in a card inside a list
 * (placement="card"). Takes no space — not even a list gap — while ads are
 * off or no banner is loaded, so the layout is identical with ads off. A failure only
 * hides it until the next retry — it never disappears for good.
 */
export function AdBanner({
  onHeight,
  placement = 'strip',
}: { onHeight?: (height: number) => void; placement?: BannerPlacement } = {}) {
  const config = useAdConfig();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const banner = useRef<LevelPlayBannerAdViewMethods>(null);
  const unitId = bannerUnitId(config);
  const native = bannerComponent();
  const hasNative = native !== null;

  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => {
      setFailed(false);
      setAttempt((n) => n + 1);
    }, RETRY_MS);
    return () => clearTimeout(t);
  }, [failed]);

  // LevelPlay banners load on request; each retry mounts a fresh view and loads it.
  useEffect(() => {
    if (!unitId || !hasNative || failed) return;
    const t = setTimeout(() => banner.current?.loadAd(), 0);
    return () => clearTimeout(t);
  }, [unitId, hasNative, failed, attempt]);

  useEffect(() => () => banner.current?.destroy(), []);

  if (!unitId || !native) return null;
  const { BannerAd, size } = native;
  const card = placement === 'card';
  const visible = loaded && !failed;
  return (
    // Reports its height so the game screen can lift its controls above it.
    <View
      style={[styles.wrap, card && styles.card, !visible && (card ? styles.hiddenInList : styles.hidden)]}
      onLayout={(e) => onHeight?.(visible ? e.nativeEvent.layout.height : 0)}
    >
      {card && visible && <Text style={styles.label}>Ad</Text>}
      {!failed && (
        <BannerAd
          key={attempt}
          ref={banner}
          adUnitId={unitId}
          adSize={size}
          placementName={null}
          style={{ width: size.width, height: size.height }}
          listener={{
            onAdLoaded: () => {
              if (__DEV__) console.log('[ads]', placement, 'banner loaded');
              setLoaded(true);
            },
            // Tapping the ad leaves the app; coming back shouldn't trigger another ad.
            onAdClicked: skipNextReturnAd,
            onAdLoadFailed: (e) => {
              if (__DEV__) console.log('[ads]', placement, 'banner failed to load', e);
              setLoaded(false);
              setFailed(true);
              onHeight?.(0);
            },
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  card: {
    paddingTop: 22,
    paddingBottom: 10,
    borderRadius: 4,
    backgroundColor: INK.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.paperEdge,
  },
  label: {
    position: 'absolute',
    top: 4,
    left: 10,
    paddingHorizontal: 5,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: INK.brass,
    fontFamily: FONT.label,
    fontSize: 10,
    color: INK.paper,
  },
  hidden: { height: 0, padding: 0, borderWidth: 0, overflow: 'hidden' },
  // Out of the list's flow, so the list adds no gap for it while it's empty.
  hiddenInList: { position: 'absolute', width: 0, height: 0, padding: 0, borderWidth: 0, overflow: 'hidden' },
});
