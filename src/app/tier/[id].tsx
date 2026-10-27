import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProgress } from '../../game/progress';
import { TIERS } from '../../game/tiers';
import { LevelTile } from '../../ui/components/LevelTile';
import { MenuButton, MenuScreen } from '../../ui/components/MenuKit';
import { openLevel } from '../../ui/openLevel';
import { TIER_ICONS, tierStats } from '../../ui/tierInfo';
import { FONT, INK } from '../../ui/theme';

const COLUMNS = 5;
const GAP = 10;

/** One gallery (tier): its own header, progress and grid of levels. */
export default function TierLevels() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useProgress();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tier = TIERS.find((t) => t.id === id);

  if (!tier) return <Redirect href="/tiers" />;

  const s = tierStats(tier, state);
  const levels = Array.from({ length: s.total }, (_, k) => tier.start + k);
  const nextUnsolved = levels.find((i) => !state.levels[i]);
  const tile = Math.floor((Math.min(width, 520) - 40 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <MenuScreen title={tier.name} scroll={false}>
      <FlatList
        data={levels}
        numColumns={COLUMNS}
        keyExtractor={(i) => String(i)}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heroRow}>
              <View style={[styles.icon, { backgroundColor: tier.color }]}>
                <Ionicons name={TIER_ICONS[tier.id]} size={26} color={INK.paper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.blurb}>{tier.blurb}</Text>
                <Text style={styles.range}>
                  Levels {tier.start + 1}–{tier.end + 1}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <Text style={styles.stat}>
                <Text style={styles.statStrong}>{s.solved}</Text> / {s.total} solved
              </Text>
              <View style={styles.bulbs}>
                <Ionicons name="bulb" size={14} color={INK.brass} />
                <Text style={styles.stat}>
                  <Text style={styles.statStrong}>{s.bulbs}</Text> / {s.total * 3}
                </Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(s.solved / s.total) * 100}%`, backgroundColor: tier.color }]} />
            </View>

            {nextUnsolved !== undefined && !s.locked && (
              <View style={{ marginTop: 16 }}>
                <MenuButton
                  variant="primary"
                  icon="play"
                  label={s.solved === 0 ? `Start ${tier.name}` : 'Continue'}
                  sublabel={`Level ${nextUnsolved + 1}`}
                  onPress={() => openLevel(nextUnsolved)}
                />
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => <LevelTile index={item} size={tile} state={state} color={tier.color} />}
      />
    </MenuScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  blurb: { fontFamily: FONT.bodyItalic, fontSize: 15, color: INK.ink },
  range: { fontFamily: FONT.body, fontSize: 13, color: INK.inkSoft, marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  stat: { fontFamily: FONT.body, fontSize: 14, color: INK.inkSoft },
  statStrong: { fontFamily: FONT.numeral, color: INK.ink },
  bulbs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: INK.inkFaint, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 3 },
});
