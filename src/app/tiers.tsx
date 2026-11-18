import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AdNativeCard } from '../ads/AdNativeCard';
import { useProgress } from '../game/progress';
import { TIERS } from '../game/tiers';
import { MenuScreen } from '../ui/components/MenuKit';
import { TIER_ICONS, tierStats } from '../ui/tierInfo';
import { FONT, INK } from '../ui/theme';

export default function Tiers() {
  const state = useProgress();

  return (
    <MenuScreen title="Choose a gallery">
      <Text style={styles.lead}>Five rooms, from gentle outlines to the most intricate works.</Text>
      <View style={styles.list}>
        {TIERS.map((tier, i) => {
          const s = tierStats(tier, state);
          const done = s.solved === s.total;
          return (
            <Fragment key={tier.id}>
            {i === 2 && <AdNativeCard />}
            <Animated.View entering={FadeInDown.duration(380).delay(60 * i)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${tier.name}, levels ${tier.start + 1} to ${tier.end + 1}${s.locked ? ', locked' : ''}`}
                disabled={s.locked}
                onPress={() => router.push(`/tier/${tier.id}`)}
                style={({ pressed }) => [styles.card, s.locked && styles.cardLocked, pressed && styles.pressed]}
              >
                <View style={[styles.stripe, { backgroundColor: tier.color }]} />
                <View style={[styles.icon, { borderColor: tier.color }]}>
                  <Ionicons name={s.locked ? 'lock-closed' : TIER_ICONS[tier.id]} size={22} color={tier.color} />
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text style={styles.name}>{tier.name}</Text>
                    <Text style={styles.range}>
                      {tier.start + 1}–{tier.end + 1}
                    </Text>
                  </View>
                  <Text style={styles.blurb} numberOfLines={1}>
                    {tier.blurb}
                  </Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${(s.solved / s.total) * 100}%`, backgroundColor: tier.color }]} />
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>
                      {done ? 'Complete' : `${s.solved} of ${s.total} solved`}
                    </Text>
                    <View style={styles.bulbs}>
                      <Ionicons name="bulb" size={12} color={INK.brass} />
                      <Text style={styles.meta}>
                        {s.bulbs}/{s.total * 3}
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={INK.inkSoft} />
              </Pressable>
            </Animated.View>
            </Fragment>
          );
        })}
      </View>
    </MenuScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21, color: INK.inkSoft, marginTop: 2 },
  list: { gap: 12, marginTop: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: 4,
    backgroundColor: INK.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK.paperEdge,
    overflow: 'hidden',
    shadowColor: '#2a1a0e',
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 2, height: 4 },
    elevation: 3,
  },
  cardLocked: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.985 }] },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  icon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name: { fontFamily: FONT.title, fontSize: 21, color: INK.ink },
  range: { fontFamily: FONT.body, fontSize: 13, color: INK.inkSoft },
  blurb: { fontFamily: FONT.bodyItalic, fontSize: 13, color: INK.inkSoft },
  track: { height: 4, borderRadius: 2, backgroundColor: INK.inkFaint, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontFamily: FONT.body, fontSize: 12, color: INK.inkSoft },
  bulbs: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
