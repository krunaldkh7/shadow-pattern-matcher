import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FONT, INK } from '../ui/theme';
import { useAdLoadingVeil } from './googleAds';

/** Full-screen "Loading ad…" shown for a moment before an interstitial opens. */
export function AdLoadingVeil() {
  const visible = useAdLoadingVeil();
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.layer}>
      <View style={styles.card}>
        <ActivityIndicator color={INK.ink} />
        <Text style={styles.text}>Loading ad…</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(27,19,13,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 4,
    backgroundColor: INK.paper,
  },
  text: { fontFamily: FONT.label, fontSize: 15, color: INK.ink },
});
