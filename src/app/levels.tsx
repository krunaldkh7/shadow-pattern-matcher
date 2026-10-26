import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEVEL_COUNT } from '../game/levels';
import { totalStars, useProgress } from '../game/progress';
import { MenuScreen } from '../ui/components/MenuKit';
import { FONT, INK } from '../ui/theme';

const COLUMNS = 5;
const GAP = 10;
const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, i) => i);

export default function Levels() {
  const state = useProgress();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tile = Math.floor((Math.min(width, 520) - 40 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <MenuScreen title="Levels" scroll={false}>
      <Text style={styles.summary}>
        {Object.keys(state.levels).length} of {LEVEL_COUNT} solved · {totalStars(state)} bulbs
      </Text>
      <FlatList
        data={LEVELS}
        numColumns={COLUMNS}
        keyExtractor={(i) => String(i)}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 24 }}
        initialNumToRender={40}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: i }) => {
          const locked = i > state.unlocked;
          const record = state.levels[i];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={locked ? `Level ${i + 1}, locked` : `Level ${i + 1}`}
              disabled={locked}
              onPress={() => router.push(`/play/${i}`)}
              style={({ pressed }) => [
                styles.tile,
                { width: tile, height: tile + 10 },
                record ? styles.solved : locked ? styles.locked : styles.open,
                pressed && styles.pressed,
              ]}
            >
              {locked ? (
                <Ionicons name="lock-closed" size={18} color={INK.inkFaint} />
              ) : (
                <>
                  <Text style={[styles.number, record && { color: INK.paper }]}>{i + 1}</Text>
                  <View style={styles.bulbs}>
                    {[0, 1, 2].map((b) => (
                      <Ionicons
                        key={b}
                        name={record && b < record.stars ? 'bulb' : 'bulb-outline'}
                        size={10}
                        color={record ? (b < record.stars ? INK.bulbLit : 'rgba(239,228,204,0.35)') : INK.inkFaint}
                      />
                    ))}
                  </View>
                </>
              )}
            </Pressable>
          );
        }}
      />
    </MenuScreen>
  );
}

const styles = StyleSheet.create({
  summary: { fontFamily: FONT.body, fontSize: 15, color: INK.inkSoft, marginBottom: 14 },
  tile: { borderRadius: 3, alignItems: 'center', justifyContent: 'center', gap: 3 },
  open: { borderWidth: 1.5, borderColor: INK.ink, backgroundColor: 'rgba(239,228,204,0.45)' },
  solved: { backgroundColor: INK.ink },
  locked: { borderWidth: 1, borderColor: INK.inkFaint },
  pressed: { opacity: 0.7 },
  number: { fontFamily: FONT.numeral, fontSize: 20, color: INK.ink, fontVariant: ['tabular-nums'] },
  bulbs: { flexDirection: 'row' },
});
