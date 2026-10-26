import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEVEL_COUNT } from '../game/levels';
import { isLevelUnlocked, totalStars, useProgress, type ProgressState } from '../game/progress';
import { TIERS, type Tier } from '../game/tiers';
import { MenuScreen } from '../ui/components/MenuKit';
import { FONT, INK } from '../ui/theme';

const COLUMNS = 5;
const GAP = 10;

/** One section per tier; each row holds up to COLUMNS level indices. */
const SECTIONS = TIERS.map((tier) => {
  const rows: number[][] = [];
  for (let i = tier.start; i <= tier.end; i += COLUMNS) {
    rows.push(Array.from({ length: Math.min(COLUMNS, tier.end - i + 1) }, (_, k) => i + k));
  }
  return { tier, data: rows };
});

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
      <SectionList
        sections={SECTIONS}
        keyExtractor={(row) => String(row[0])}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        renderSectionHeader={({ section }) => <TierHeader tier={section.tier} state={state} />}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((i) => (
              <LevelTile key={i} index={i} size={tile} state={state} color={TIERS.find((t) => i <= t.end)!.color} />
            ))}
          </View>
        )}
      />
    </MenuScreen>
  );
}

function TierHeader({ tier, state }: { tier: Tier; state: ProgressState }) {
  const total = tier.end - tier.start + 1;
  let solved = 0;
  for (let i = tier.start; i <= tier.end; i++) if (state.levels[i]) solved++;
  const locked = !isLevelUnlocked(state, tier.start);

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={[styles.badge, { backgroundColor: tier.color }]}>
          <Text style={styles.badgeText}>{tier.name}</Text>
        </View>
        <Text style={styles.range}>
          {tier.start + 1}–{tier.end + 1}
        </Text>
        <View style={{ flex: 1 }} />
        {locked ? (
          <Ionicons name="lock-closed" size={14} color={INK.inkSoft} />
        ) : (
          <Text style={styles.count}>
            {solved}/{total}
          </Text>
        )}
      </View>
      <Text style={styles.blurb}>{tier.blurb}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(solved / total) * 100}%`, backgroundColor: tier.color }]} />
      </View>
    </View>
  );
}

function LevelTile({ index: i, size, state, color }: { index: number; size: number; state: ProgressState; color: string }) {
  const locked = !isLevelUnlocked(state, i);
  const record = state.levels[i];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locked ? `Level ${i + 1}, locked` : `Level ${i + 1}`}
      disabled={locked}
      onPress={() => router.push(`/play/${i}`)}
      style={({ pressed }) => [
        styles.tile,
        { width: size, height: size + 10 },
        record ? styles.solved : locked ? styles.locked : [styles.open, { borderColor: color }],
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
}

const styles = StyleSheet.create({
  summary: { fontFamily: FONT.body, fontSize: 15, color: INK.inkSoft, marginBottom: 4 },
  header: { marginTop: 20, marginBottom: 12, gap: 6 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 3 },
  badgeText: { fontFamily: FONT.label, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: INK.paper },
  range: { fontFamily: FONT.body, fontSize: 14, color: INK.inkSoft },
  count: { fontFamily: FONT.numeral, fontSize: 14, color: INK.ink, fontVariant: ['tabular-nums'] },
  blurb: { fontFamily: FONT.bodyItalic, fontSize: 14, color: INK.inkSoft },
  track: { height: 4, borderRadius: 2, backgroundColor: INK.inkFaint, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  tile: { borderRadius: 3, alignItems: 'center', justifyContent: 'center', gap: 3 },
  open: { borderWidth: 1.5, backgroundColor: 'rgba(239,228,204,0.45)' },
  solved: { backgroundColor: INK.ink },
  locked: { borderWidth: 1, borderColor: INK.inkFaint },
  pressed: { opacity: 0.7 },
  number: { fontFamily: FONT.numeral, fontSize: 20, color: INK.ink, fontVariant: ['tabular-nums'] },
  bulbs: { flexDirection: 'row' },
});
