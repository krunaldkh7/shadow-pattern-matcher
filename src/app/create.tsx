import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { customLevels } from '../game/customLevels';
import type { Stroke } from '../game/shapes';
import { DrawingPad } from '../ui/components/DrawingPad';
import { MenuButton, MenuScreen } from '../ui/components/MenuKit';
import { FONT, INK } from '../ui/theme';

/** Total outline length (in shape units) a drawing needs to make a playable shadow. */
const MIN_LENGTH = 2.5;
const MAX_NAME = 24;

function outlineLength(strokes: Stroke[]) {
  let total = 0;
  for (const s of strokes) {
    const pts = s.closed ? [...s.points, s.points[0]] : s.points;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return total;
}

/** Draw a shape with one finger; it becomes a level whose wire casts that shadow. */
export default function Create() {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 40, 360);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [name, setName] = useState('');

  const save = () => {
    if (outlineLength(strokes) < MIN_LENGTH) {
      Alert.alert('Draw a little more', 'Your shape is too small to make a good puzzle. Draw a bigger outline or add another line.');
      return;
    }
    const level = customLevels.add(name, strokes);
    router.replace(`/play/custom/${level.id}`);
  };

  return (
    // No scrolling (a vertical stroke would scroll the page) and no tap-counted ads mid-drawing.
    <MenuScreen title="Create a level" scroll={false} countTaps={false}>
      <Text style={styles.lead}>
        Draw a picture with your finger. Lift to start a new line; end a line where it began to close it.
      </Text>

      <DrawingPad size={size} strokes={strokes} onStrokesChange={setStrokes} />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <MenuButton icon="arrow-undo" label="Undo line" onPress={() => setStrokes((s) => s.slice(0, -1))} />
        </View>
        <View style={{ flex: 1 }}>
          <MenuButton icon="trash-outline" label="Clear" onPress={() => setStrokes([])} />
        </View>
      </View>

      <TextInput
        value={name}
        onChangeText={(t) => setName(t.slice(0, MAX_NAME))}
        placeholder="Name your shape"
        placeholderTextColor={INK.inkSoft}
        style={styles.input}
        returnKeyType="done"
        accessibilityLabel="Level name"
      />

      <MenuButton variant="primary" icon="play" label="Save & play" onPress={save} />
    </MenuScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20, color: INK.inkSoft, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  input: {
    marginVertical: 12,
    height: 48,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: INK.ink,
    paddingHorizontal: 14,
    fontFamily: FONT.label,
    fontSize: 16,
    color: INK.ink,
    backgroundColor: 'rgba(239,228,204,0.45)',
  },
});
