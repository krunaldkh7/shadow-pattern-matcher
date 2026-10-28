import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { customLevels, useCustomLevels, type CustomLevel } from '../game/customLevels';
import { MenuButton, MenuScreen } from '../ui/components/MenuKit';
import { FONT, INK } from '../ui/theme';

/** The player's own levels: create a new one, play, or delete. */
export default function MyLevels() {
  const levels = useCustomLevels();

  return (
    <MenuScreen title="My levels">
      <Text style={styles.lead}>Draw any picture and it becomes a shadow puzzle you can play.</Text>
      <MenuButton variant="primary" icon="brush-outline" label="Create a level" onPress={() => router.push('/create')} />

      <View style={styles.list}>
        {levels.length === 0 ? (
          <Text style={styles.empty}>No levels yet. Your creations will appear here.</Text>
        ) : (
          levels.map((l) => <LevelRow key={l.id} level={l} />)
        )}
      </View>
    </MenuScreen>
  );
}

function LevelRow({ level }: { level: CustomLevel }) {
  const confirmDelete = () =>
    Alert.alert(`Delete "${level.name}"?`, 'This level will be removed for good.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => customLevels.remove(level.id) },
    ]);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${level.name}`}
        onPress={() => router.push(`/play/custom/${level.id}`)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Ionicons name="shapes-outline" size={22} color={INK.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {level.name}
          </Text>
          <View style={styles.meta}>
            {[0, 1, 2].map((b) => (
              <Ionicons
                key={b}
                name={level.best && b < level.best.stars ? 'bulb' : 'bulb-outline'}
                size={12}
                color={level.best && b < level.best.stars ? INK.brass : INK.inkFaint}
              />
            ))}
            <Text style={styles.metaText}>{level.best ? `Best ${level.best.seconds}s` : 'Not solved yet'}</Text>
          </View>
        </View>
        <Ionicons name="play" size={18} color={INK.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${level.name}`} hitSlop={8} onPress={confirmDelete} style={styles.delete}>
        <Ionicons name="trash-outline" size={18} color={INK.inkSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21, color: INK.inkSoft, marginBottom: 14 },
  list: { gap: 10, marginTop: 18 },
  empty: { fontFamily: FONT.bodyItalic, fontSize: 14, color: INK.inkSoft, textAlign: 'center', marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 4,
    backgroundColor: INK.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.paperEdge,
  },
  pressed: { opacity: 0.75 },
  name: { fontFamily: FONT.title, fontSize: 17, color: INK.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  metaText: { fontFamily: FONT.body, fontSize: 12, color: INK.inkSoft, marginLeft: 6 },
  delete: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
