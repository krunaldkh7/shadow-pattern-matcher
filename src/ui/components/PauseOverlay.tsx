import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FONT, INK } from '../theme';
import { MenuButton } from './MenuKit';

interface Props {
  levelNumber: number;
  onResume: () => void;
  onRestart: () => void;
  onLevels: () => void;
  onSettings: () => void;
}

/** Paused: the wall dims and a placard offers the way out. Blocks all touches below. */
export function PauseOverlay({ levelNumber, onResume, onRestart, onLevels, onSettings }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.layer}>
      <View style={styles.card}>
        <Text style={styles.small}>No. {levelNumber}</Text>
        <Text style={styles.title}>Paused</Text>
        <View style={styles.buttons}>
          <MenuButton variant="primary" icon="play" label="Resume" onPress={onResume} />
          <MenuButton icon="refresh" label="Restart level" onPress={onRestart} />
          <MenuButton icon="grid-outline" label="All levels" onPress={onLevels} />
          <MenuButton icon="settings-outline" label="Settings" onPress={onSettings} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(27,19,13,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  card: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: INK.paper,
    borderRadius: 3,
    padding: 22,
    shadowColor: '#2a1a0e',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 4, height: 8 },
    elevation: 8,
  },
  small: { fontFamily: FONT.label, fontSize: 14, color: INK.inkSoft },
  title: { fontFamily: FONT.title, fontSize: 36, color: INK.ink, marginBottom: 18 },
  buttons: { gap: 10 },
});
