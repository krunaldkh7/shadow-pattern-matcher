import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LevelPlayBannerAdViewMethods } from 'unity-levelplay-mediation';
import { FONT, INK } from '../ui/theme';
import { useAdConfig } from './adConfig';
import { bannerComponent, bannerUnitId, skipNextReturnAd, type BannerSize } from './unityAds';

/** After a failed load, try a fresh banner this much later. */
const RETRY_MS = 30_000;

/**
 * Banner ad: the bottom strip by default, or a 300×250 medium rectangle
 * (size="mrec") set inside a list. Takes no space while ads are off or no
 * banner is loaded, so the layout is identical with ads off. A failure only
 * hides it until the next retry — it never disappears for good.
 */
export function AdBanner({ onHeight, size: kind = 'banner' }: { onHeight?: (height: number) => void; size?: BannerSize } = {}) {
  const config = useAdConfig();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const banner = useRef<LevelPlayBannerAdViewMethods>(null);
  const unitId = bannerUnitId(config);
  const native = bannerComponent(kind);
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
  }, [unitId, hasNative, kind, failed, attempt]);

  useEffect(() => () => banner.current?.destroy(), []);

  if (!unitId || !native) return null;
  const { BannerAd, size } = native;
  const mrec = kind === 'mrec';
  const visible = loaded && !failed;
  return (
    // Reports its height so the game screen can lift its controls above it.
    <View
      style={[styles.wrap, mrec && styles.card, !visible && styles.hidden]}
      onLayout={(e) => onHeight?.(visible ? e.nativeEvent.layout.height : 0)}
    >
      {mrec && visible && <Text style={styles.label}>Ad</Text>}
      {!failed && (
        <BannerAd
          key={attempt}
          ref={banner}
          adUnitId={unitId}
          adSize={size}
          placementName={null}
          style={{ width: size.width, height: size.height }}
          listener={{
            onAdLoaded: () => setLoaded(true),
            // Tapping the ad leaves the app; coming back shouldn't trigger another ad.
            onAdClicked: skipNextReturnAd,
            onAdLoadFailed: () => {
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
});
