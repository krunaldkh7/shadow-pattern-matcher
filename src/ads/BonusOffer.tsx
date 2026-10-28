import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONT, INK } from '../ui/theme';
import { showRewardedInterstitial } from './googleAds';

const COUNTDOWN_S = 5;

interface Props {
  /** Called once the viewer has earned the reward. */
  onEarned: () => void;
  /** Called when the offer is over (declined, played, or failed) so the card can hide it. */
  onDone: () => void;
}

/**
 * The intro screen AdMob requires before a rewarded interstitial: it states
 * the reward, counts down, and lets the player opt out. Only when the
 * countdown finishes does the ad play.
 */
export function BonusOffer({ onEarned, onDone }: Props) {
  const [left, setLeft] = useState(COUNTDOWN_S);
  const finished = useRef(false);

  useEffect(() => {
    if (left <= 0) {
      if (finished.current) return;
      finished.current = true;
      showRewardedInterstitial().then((result) => {
        if (result === 'earned') onEarned();
        onDone();
      });
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onEarned, onDone]);

  const decline = () => {
    finished.current = true;
    onDone();
  };

  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Ionicons name="bulb" size={18} color={INK.bulbLit} />
        <Text style={styles.title}>Earn all 3 bulbs</Text>
      </View>
      <Text style={styles.body}>
        Watch a short ad to light every bulb for this level. Starting in {Math.max(0, left)}…
      </Text>
      <Pressable accessibilityRole="button" onPress={decline} hitSlop={10} style={styles.decline}>
        <Text style={styles.declineText}>No thanks</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    maxWidth: 330,
    borderWidth: 1,
    borderColor: INK.brass,
    borderRadius: 3,
    padding: 12,
    backgroundColor: INK.paper,
    gap: 4,
    shadowColor: '#2a1a0e',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 5 },
    elevation: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: FONT.label, fontSize: 15, color: INK.ink },
  body: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, color: INK.inkSoft },
  decline: { alignSelf: 'flex-end', marginTop: 2 },
  declineText: { fontFamily: FONT.label, fontSize: 13, color: INK.ink, textDecorationLine: 'underline' },
});
