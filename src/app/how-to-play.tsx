import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { MenuButton, MenuScreen } from '../ui/components/MenuKit';
import { FONT, INK } from '../ui/theme';

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'sunny-outline', title: 'Find the picture', body: 'A spotlight casts the gold wire’s shadow on the wall. The dotted outline shows the picture it should make.' },
  { icon: 'hand-left-outline', title: 'Drag to turn', body: 'Slide one finger to tip the sculpture up, down and sideways. Flick it and it keeps spinning.' },
  { icon: 'sync-outline', title: 'Twist with two fingers', body: 'Rotate two fingers to spin the sculpture flat against the wall.' },
  { icon: 'checkmark-circle-outline', title: 'Match it', body: 'The meter at the top fills as the shadow lines up. Get close and it snaps into place.' },
  { icon: 'bulb-outline', title: 'Keep your bulbs', body: 'Stuck? The bulb turns the wire halfway, and the eye shows a ghost of the answer. Each hint costs one of three bulbs.' },
];

export default function HowToPlay() {
  // Set when opened from the first "Play": continue straight into that level.
  const { then } = useLocalSearchParams<{ then?: string }>();

  return (
    <MenuScreen title="How to play">
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={styles.step}>
            <View style={styles.badge}>
              <Ionicons name={s.icon} size={22} color={INK.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>
                {i + 1}. {s.title}
              </Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <MenuButton
        variant="primary"
        label={then ? 'Start playing' : 'Got it'}
        onPress={() => (then ? router.replace(`/play/${then}`) : router.back())}
      />
    </MenuScreen>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 20, marginVertical: 16 },
  step: { flexDirection: 'row', gap: 14 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: INK.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,228,204,0.32)',
  },
  stepTitle: { fontFamily: FONT.label, fontSize: 17, color: INK.ink },
  stepBody: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21, color: INK.inkSoft, marginTop: 3 },
});
