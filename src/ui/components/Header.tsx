import { StyleSheet, Text, View } from 'react-native';
import { FONT, INK } from '../theme';
import { IconButton } from './IconButton';

interface Props {
  levelNumber: number;
  accuracy: number; // 0..100
  solved: boolean;
  onLightbulb: () => void;
  hintDisabled: boolean;
  onPause: () => void;
}

const DOTS = 20;

/**
 * Top of the wall: piece number, the live match reading, and the lightbulb.
 *
 * The meter is a row of 20 dots — the same dots that draw the target outline —
 * which fill with ink as the shadow lines up (one dot per 5%).
 */
export function Header({ levelNumber, accuracy, solved, onLightbulb, hintDisabled, onPause }: Props) {
  const filled = Math.round(accuracy / (100 / DOTS));

  return (
    <View style={styles.row}>
      <View style={styles.piece}>
        <IconButton icon="pause" size={44} onPress={onPause} accessibilityLabel={`Pause level ${levelNumber}`} />
        <Text style={styles.pieceNumber}>No. {levelNumber}</Text>
      </View>

      <View style={styles.meter} accessibilityLabel={`${accuracy} percent match`}>
        <Text style={styles.reading}>
          <Text style={styles.value}>{accuracy}</Text>
          <Text style={styles.unit}>{solved ? '% matched' : '% match'}</Text>
        </Text>
        <View style={styles.dots}>
          {Array.from({ length: DOTS }, (_, i) => (
            <View key={i} style={[styles.dot, i < filled ? styles.dotOn : styles.dotOff]} />
          ))}
        </View>
      </View>

      <IconButton
        icon="bulb-outline"
        size={44}
        onPress={onLightbulb}
        disabled={hintDisabled}
        accessibilityLabel="Hint: turn the sculpture halfway to the answer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  piece: { width: 70, alignItems: 'flex-start', gap: 4 },
  pieceNumber: { fontFamily: FONT.numeral, fontSize: 16, color: INK.ink },
  meter: { flex: 1, alignItems: 'center' },
  reading: { color: INK.ink },
  value: { fontFamily: FONT.numeral, fontSize: 44, lineHeight: 50, color: INK.ink, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: FONT.body, fontSize: 16, color: INK.inkSoft },
  dots: { flexDirection: 'row', gap: 4, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotOn: { backgroundColor: INK.ink },
  dotOff: { backgroundColor: INK.inkFaint },
});
