import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FONT, INK } from '../theme';

/** First-touch instruction, written on the wall under the sculpture. Gone after the first drag. */
export function DragHint({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.delay(500).duration(500)} exiting={FadeOut.duration(250)} style={styles.wrap} pointerEvents="none">
      <Text style={styles.title}>Drag to rotate</Text>
      <Text style={styles.sub}>Twist with two fingers to spin it</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  title: { fontFamily: FONT.title, fontSize: 24, color: INK.ink },
  sub: { fontFamily: FONT.body, fontSize: 15, color: INK.inkSoft, marginTop: 2 },
});
