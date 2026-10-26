import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, Keyframe } from 'react-native-reanimated';
import { FONT, INK } from '../theme';

interface Props {
  levelNumber: number;
  shapeName: string;
  bulbsLeft: number;
  hintsUsed: number;
  solveSeconds: number;
  bottomInset: number;
  /** Final level: the primary button finishes the run instead. */
  isLast: boolean;
  onNext: () => void;
  onReplay: () => void;
  onMenu: () => void;
}

/**
 * Solved: a gallery wall label is pinned up under the finished shadow.
 *
 * Nothing dims the scene — the gold silhouette above the card IS the reward,
 * so it stays in view. The card is the one bold element of the UI: real card
 * stock, a brass pin, a slight hand-hung tilt, clean label typography.
 */
const pinUp = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -28 }, { rotate: '-7deg' }] },
  60: { opacity: 1, transform: [{ translateY: 4 }, { rotate: '0deg' }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { rotate: '-1.6deg' }] },
}).duration(560);

function formatTime(s: number) {
  if (s < 60) return `${s} seconds`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

export function LevelCompleteOverlay({
  levelNumber,
  shapeName,
  bulbsLeft,
  hintsUsed,
  solveSeconds,
  bottomInset,
  isLast,
  onNext,
  onReplay,
  onMenu,
}: Props) {
  const hintLine = hintsUsed === 0 ? 'No hints used' : hintsUsed === 1 ? '1 hint used' : `${hintsUsed} hints used`;

  return (
    <View style={[styles.layer, { paddingBottom: bottomInset + 18 }]} pointerEvents="box-none">
      <Animated.View entering={pinUp} exiting={FadeOut.duration(180)} style={styles.card}>
        <View style={styles.pin}>
          <View style={styles.pinShine} />
        </View>

        <Text style={styles.number}>No. {levelNumber}</Text>
        <Text style={styles.title}>{shapeName}</Text>
        <Text style={styles.medium}>Gold wire and a single spotlight</Text>

        <View style={styles.rule} />

        <View style={styles.factsRow}>
          <View>
            <Text style={styles.fact}>Matched in {formatTime(solveSeconds)}</Text>
            <Text style={styles.factSoft}>{hintLine}</Text>
          </View>
          <View style={styles.bulbs} accessibilityLabel={`${bulbsLeft} of 3 bulbs kept`}>
            {[0, 1, 2].map((i) => (
              <Ionicons
                key={i}
                name={i < bulbsLeft ? 'bulb' : 'bulb-outline'}
                size={20}
                color={i < bulbsLeft ? INK.brass : INK.inkFaint}
              />
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={isLast ? onMenu : onNext}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
        >
          <Text style={styles.primaryText}>{isLast ? 'Gallery complete — back to menu' : 'Next level'}</Text>
        </Pressable>
        <View style={styles.links}>
          <Pressable accessibilityRole="button" onPress={onReplay} hitSlop={8} style={styles.secondary}>
            <Text style={styles.secondaryText}>Play again</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onMenu} hitSlop={8} style={styles.secondary}>
            <Text style={styles.secondaryText}>All levels</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 30 },
  card: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: INK.paper,
    borderRadius: 3,
    paddingTop: 26,
    paddingBottom: 14,
    paddingHorizontal: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.paperEdge,
    // Cast by the same warm spotlight: down and slightly right.
    shadowColor: '#2a1a0e',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 4, height: 8 },
    elevation: 8,
    transform: [{ rotate: '-1.6deg' }],
  },
  pin: {
    position: 'absolute',
    top: -7,
    alignSelf: 'center',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: INK.brass,
    shadowColor: '#2a1a0e',
    shadowOpacity: 0.45,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 3 },
    elevation: 4,
  },
  pinShine: { position: 'absolute', top: 3, left: 4, width: 5, height: 4, borderRadius: 3, backgroundColor: 'rgba(255,240,200,0.75)' },
  number: { fontFamily: FONT.label, fontSize: 14, color: INK.inkSoft },
  title: { fontFamily: FONT.title, fontSize: 40, lineHeight: 46, letterSpacing: -0.5, color: INK.ink, marginTop: 2 },
  medium: { fontFamily: FONT.bodyItalic, fontSize: 15, color: INK.inkSoft, marginTop: 2 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: INK.inkFaint, marginVertical: 16 },
  factsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  fact: { fontFamily: FONT.label, fontSize: 15, color: INK.ink },
  factSoft: { fontFamily: FONT.body, fontSize: 14, color: INK.inkSoft, marginTop: 2 },
  bulbs: { flexDirection: 'row', gap: 2 },
  primary: { height: 50, borderRadius: 3, backgroundColor: INK.ink, alignItems: 'center', justifyContent: 'center' },
  primaryPressed: { backgroundColor: '#2c2018' },
  primaryText: { fontFamily: FONT.label, fontSize: 17, color: INK.paper },
  links: { flexDirection: 'row', justifyContent: 'space-around' },
  secondary: { height: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { fontFamily: FONT.body, fontSize: 15, color: INK.ink, textDecorationLine: 'underline' },
});
