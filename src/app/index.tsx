import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LEVEL_COUNT } from '../game/levels';
import { continueIndex, totalPoints, totalStars, useProgress } from '../game/progress';
import { LEVEL_SHAPES, tierOf } from '../game/tiers';
import { MenuButton, MenuScreen } from '../ui/components/MenuKit';
import { buildDots, WireDots } from '../ui/components/WireDots';
import { intro } from '../ui/introState';
import { openLevel } from '../ui/openLevel';
import { FONT, INK } from '../ui/theme';

/** Each full turn, the teaser lines up (yaw = 0) for a brief "glimpse". */
const TURN_MS = 7000;

export default function Home() {
  const state = useProgress();
  const solved = Object.keys(state.levels).length;
  const next = continueIndex(state);
  const fresh = solved === 0;
  const stars = totalStars(state);
  const record = state.levels[next];

  const dots = useMemo(() => buildDots(LEVEL_SHAPES[next], 0.11, 11 + next), [next]);
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(Math.PI * 2, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(
      withSequence(withTiming(1, { duration: 1100 }), withTiming(0, { duration: 1100 })),
      -1,
      false,
    );
  }, [spin, breathe]);

  // Slow down near alignment so the glimpse of the shape lingers.
  const yaw = useDerivedValue(() => {
    const t = spin.value;
    return t - 0.55 * Math.sin(t);
  });
  const pitch = useDerivedValue(() => 0.35 * Math.sin(spin.value * 2) * Math.min(1, Math.abs(Math.sin(spin.value / 2)) * 3));
  const glow = useDerivedValue<number>(() => {
    const c = Math.cos(yaw.value);
    return c > 0.985 ? 1 : 0;
  });
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.025 }] }));

  if (intro.shouldShow()) return <Redirect href="/intro" />;

  const resume = () => openLevel(next);

  return (
    <MenuScreen back={false} scroll={false}>
      <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
        <View>
          <Text style={styles.kicker}>A gallery of light</Text>
          <Text style={styles.title}>Shadow Pattern{'\n'}Matcher</Text>
        </View>
        <View style={styles.headerIcons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leaderboard"
            hitSlop={10}
            onPress={() => router.push('/leaderboard')}
            style={({ pressed }) => [styles.iconRing, pressed && styles.pressed]}
          >
            <Ionicons name="trophy-outline" size={20} color={INK.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.iconRing, pressed && styles.pressed]}
          >
            <Ionicons name="settings-outline" size={20} color={INK.ink} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Teaser: the next piece, scrambled, turning on its own. */}
      <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.teaser}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Play level ${next + 1}`} onPress={resume} style={styles.teaserTap}>
          <WireDots dots={dots} yaw={yaw} pitch={pitch} glow={glow} size={78} dotSize={8} />
        </Pressable>
        <View style={styles.teaserLabel} pointerEvents="none">
          <Text style={styles.teaserSmall}>
            {fresh ? 'Your first piece' : 'Next piece'} · <Text style={{ color: tierOf(next).color }}>{tierOf(next).name}</Text>
          </Text>
          <Text style={styles.teaserTitle}>
            No. {next + 1} · {record ? LEVEL_SHAPES[next].name : 'Can you see it?'}
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(220)} style={styles.progressBlock}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            <Text style={styles.progressStrong}>{solved}</Text> of {LEVEL_COUNT} pieces
          </Text>
          <View style={styles.bulbCount}>
            <Ionicons name="bulb" size={15} color={INK.brass} />
            <Text style={styles.progressText}>
              <Text style={styles.progressStrong}>{stars}</Text> / {LEVEL_COUNT * 3}
            </Text>
            <Ionicons name="trophy" size={14} color={INK.brass} style={{ marginLeft: 8 }} />
            <Text style={styles.progressText}>
              <Text style={styles.progressStrong}>{totalPoints(state).toLocaleString()}</Text> pts
            </Text>
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(1.5, (solved / LEVEL_COUNT) * 100)}%` }]} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(320)} style={styles.buttons}>
        <Animated.View style={ctaStyle}>
          <MenuButton
            variant="primary"
            icon="play"
            label="Play"
            sublabel="Choose a gallery"
            onPress={() => router.push('/tiers')}
          />
        </Animated.View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <MenuButton
              icon="arrow-forward-circle-outline"
              label={fresh ? 'Level 1' : 'Continue'}
              sublabel={fresh ? undefined : `Level ${next + 1}`}
              onPress={resume}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MenuButton icon="help-circle-outline" label="How to play" onPress={() => router.push('/how-to-play')} />
          </View>
        </View>
        <MenuButton icon="brush-outline" label="My levels" sublabel="Draw your own puzzle" onPress={() => router.push('/my-levels')} />
      </Animated.View>
    </MenuScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 },
  kicker: { fontFamily: FONT.bodyItalic, fontSize: 15, color: INK.inkSoft },
  title: { fontFamily: FONT.numeral, fontSize: 34, lineHeight: 37, letterSpacing: -0.6, color: INK.ink, marginTop: 4 },
  headerIcons: { flexDirection: 'row', gap: 10 },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: INK.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,228,204,0.32)',
  },
  pressed: { backgroundColor: 'rgba(59,43,32,0.14)' },
  teaser: { flex: 1, marginVertical: 12 },
  teaserTap: { flex: 1 },
  teaserLabel: { alignItems: 'center', gap: 2 },
  teaserSmall: { fontFamily: FONT.label, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: INK.inkSoft },
  teaserTitle: { fontFamily: FONT.title, fontSize: 20, color: INK.ink },
  progressBlock: { marginBottom: 18, gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontFamily: FONT.body, fontSize: 15, color: INK.inkSoft },
  progressStrong: { fontFamily: FONT.numeral, color: INK.ink },
  bulbCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: INK.inkFaint, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: INK.brass },
  buttons: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
});
