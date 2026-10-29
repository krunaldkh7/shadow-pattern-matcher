import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHAPES } from '../game/shapes';
import { WALL } from '../ui/components/MenuKit';
import { buildDots, WireDots } from '../ui/components/WireDots';
import { intro } from '../ui/introState';
import { FONT, INK } from '../ui/theme';
import { haptics } from '../utils/haptics';

/**
 * Interactive intro: a scrambled cloud of gold dots that is really a heart
 * seen from the wrong angle. Dragging turns it (the same idea as the game);
 * line it up and the title is revealed. Skippable at any time.
 */

const SIZE = 120; // px per shape unit
const START_YAW = 2.1;
const START_PITCH = -1.1;
const SNAP_AT = 0.9; // match fraction that snaps into place
const DRAG = 0.008; // radians per px

export default function Intro() {
  const insets = useSafeAreaInsets();
  const dots = useMemo(() => buildDots(SHAPES.find((s) => s.id === 'heart') ?? SHAPES[0]), []);
  const yaw = useSharedValue(START_YAW);
  const pitch = useSharedValue(START_PITCH);
  const glow = useSharedValue(0);
  const nudge = useSharedValue(0);
  const done = useSharedValue(false);
  // Idle wobble rides on top of the player's yaw.
  const shownYaw = useDerivedValue(() => yaw.value + nudge.value * 0.12);
  const [match, setMatch] = useState(0);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    intro.markShown();
    // Idle wobble invites a touch until the player grabs it.
    nudge.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(-1, { duration: 900 })), -1, true);
  }, [nudge]);

  const enter = () => router.replace('/');

  const pan = usePanGesture({
    runOnJS: true,
    enabled: !solved,
    onBegin: () => {
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are meant to be written
      nudge.value = withTiming(0, { duration: 200 });
    },
    onUpdate: (e) => {
      if (done.value) return;
      yaw.value += e.changeX * DRAG;
      pitch.value += e.changeY * DRAG;
      const m = 1 - Math.min(1, (Math.abs(wrap(yaw.value)) + Math.abs(wrap(pitch.value))) / (START_YAW + Math.abs(START_PITCH)));
      setMatch(Math.round(m * 100));
      if (m >= SNAP_AT) {
        done.value = true;
        const ease = { duration: 420, easing: Easing.out(Easing.cubic) };
        yaw.value = withTiming(0, ease);
        pitch.value = withTiming(0, ease);
        glow.value = withTiming(1, { duration: 700 });
        setMatch(100);
        setSolved(true);
        haptics.success();
      }
    },
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.top}>
        <Text style={styles.kicker}>{solved ? 'Perfect match' : 'Find the hidden picture'}</Text>
        {!solved && (
          <Pressable accessibilityRole="button" onPress={enter} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.stage} collapsable={false}>
          {/* Faint target outline, like the dotted outline on the game wall. */}
          <WireDots dots={dots} yaw={shownYaw} pitch={pitch} glow={glow} size={SIZE} showTarget />
        </View>
      </GestureDetector>

      {solved ? (
        <Animated.View entering={FadeIn.duration(500).delay(250)} style={styles.bottom}>
          <Text style={styles.title}>Shadow Pattern Matcher</Text>
          <Text style={styles.sub}>That’s the whole game: turn the wire until the picture appears.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={enter}
            style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#2c2018' }]}
          >
            <Text style={styles.ctaText}>Enter the gallery</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.bottom}>
          <Text style={styles.meter}>
            {match}
            <Text style={styles.meterUnit}>% match</Text>
          </Text>
          <Text style={styles.sub}>Drag anywhere to turn the dots</Text>
        </View>
      )}
    </View>
  );
}

/** Wrap an angle into (-π, π] so a full extra turn still counts as aligned. */
function wrap(a: number) {
  'worklet';
  const t = Math.PI * 2;
  return ((((a + Math.PI) % t) + t) % t) - Math.PI;
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WALL, paddingHorizontal: 20 },
  top: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: FONT.bodyItalic, fontSize: 16, color: INK.inkSoft },
  skip: { fontFamily: FONT.label, fontSize: 16, color: INK.ink, textDecorationLine: 'underline' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { alignItems: 'center', gap: 6, minHeight: 170, justifyContent: 'flex-end' },
  meter: { fontFamily: FONT.numeral, fontSize: 44, color: INK.ink, fontVariant: ['tabular-nums'] },
  meterUnit: { fontFamily: FONT.body, fontSize: 16, color: INK.inkSoft },
  title: { fontFamily: FONT.numeral, fontSize: 30, letterSpacing: -0.5, color: INK.ink, textAlign: 'center' },
  sub: { fontFamily: FONT.body, fontSize: 15, color: INK.inkSoft, textAlign: 'center', maxWidth: 300 },
  cta: {
    marginTop: 14,
    height: 54,
    alignSelf: 'stretch',
    borderRadius: 3,
    backgroundColor: INK.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: FONT.label, fontSize: 17, color: INK.paper },
});
