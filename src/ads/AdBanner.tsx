import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAdConfig } from './adConfig';
import { bannerComponent, bannerUnitId, skipNextAppOpen } from './googleAds';

/** After a failed load (or a failed auto-refresh), try a fresh banner this much later. */
const RETRY_MS = 30_000;

/**
 * Bottom banner. Takes no space while ads are off or no banner is loaded, so
 * the layout is identical with ads off. A failure only hides it until the
 * next retry — it never disappears for good.
 */
export function AdBanner({ onHeight }: { onHeight?: (height: number) => void } = {}) {
  const config = useAdConfig();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const unitId = bannerUnitId(config);
  const native = bannerComponent();

  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => {
      setFailed(false);
      setAttempt((n) => n + 1);
    }, RETRY_MS);
    return () => clearTimeout(t);
  }, [failed]);

  if (!unitId || !native) return null;
  const { BannerAd, size } = native;
  return (
    // Reports its height so the game screen can lift its controls above it.
    <View
      style={[styles.wrap, failed && styles.hidden]}
      onLayout={(e) => onHeight?.(failed ? 0 : e.nativeEvent.layout.height)}
    >
      {!failed && (
        <BannerAd
          key={attempt}
          unitId={unitId}
          size={size}
          // Tapping the banner leaves the app; coming back shouldn't trigger an app-open ad.
          onAdOpened={skipNextAppOpen}
          onAdFailedToLoad={() => {
            setFailed(true);
            onHeight?.(0);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  hidden: { height: 0, overflow: 'hidden' },
});
