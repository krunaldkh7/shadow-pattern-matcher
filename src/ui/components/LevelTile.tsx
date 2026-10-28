import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isLevelUnlocked, type ProgressState } from '../../game/progress';
import { openLevel } from '../openLevel';
import { FONT, INK } from '../theme';

interface Props {
  index: number;
  size: number;
  state: ProgressState;
  /** Tier accent for the border of open, unsolved tiles. */
  color: string;
}

/** One level in a grid: number + bulbs when open, filled ink when solved, a lock otherwise. */
export function LevelTile({ index: i, size, state, color }: Props) {
  const locked = !isLevelUnlocked(state, i);
  const record = state.levels[i];
  const skipped = !!record?.skipped;
  const solved = !!record && !skipped;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locked ? `Level ${i + 1}, locked` : `Level ${i + 1}`}
      disabled={locked}
      onPress={() => openLevel(i)}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size + 10 },
        solved ? styles.solved : skipped ? styles.skipped : locked ? styles.locked : [styles.open, { borderColor: color }],
        pressed && styles.pressed,
      ]}
    >
      {locked ? (
        <Ionicons name="lock-closed" size={18} color={INK.inkFaint} />
      ) : (
        <>
          <Text style={[styles.number, solved && { color: INK.paper }]}>{i + 1}</Text>
          {skipped ? (
            <Ionicons name="play-skip-forward" size={11} color={INK.inkSoft} accessibilityLabel="Skipped" />
          ) : (
            <View style={styles.bulbs}>
              {[0, 1, 2].map((b) => (
                <Ionicons
                  key={b}
                  name={solved && b < record!.stars ? 'bulb' : 'bulb-outline'}
                  size={10}
                  color={solved ? (b < record!.stars ? INK.bulbLit : 'rgba(239,228,204,0.35)') : INK.inkFaint}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 3, alignItems: 'center', justifyContent: 'center', gap: 3 },
  open: { borderWidth: 1.5, backgroundColor: 'rgba(239,228,204,0.45)' },
  solved: { backgroundColor: INK.ink },
  skipped: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: INK.ink },
  locked: { borderWidth: 1, borderColor: INK.inkFaint },
  pressed: { opacity: 0.7 },
  number: { fontFamily: FONT.numeral, fontSize: 20, color: INK.ink, fontVariant: ['tabular-nums'] },
  bulbs: { flexDirection: 'row' },
});
