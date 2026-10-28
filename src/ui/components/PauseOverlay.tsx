import { Alert, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { FONT, INK } from '../theme';
import { MenuButton } from './MenuKit';

interface Props {
  label: string;
  onResume: () => void;
  onRestart: () => void;
  onLevels: () => void;
  onHome: () => void;
  onSettings: () => void;
}

/**
 * Exit is Android-only: iOS apps must not quit themselves (App Review rejects
 * it), so there the player leaves with the home gesture as usual.
 */
const CAN_EXIT = Platform.OS === 'android';

function confirmExit() {
  Alert.alert('Exit game?', 'Your solved levels are saved. This level will start over next time.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
  ]);
}

/** Paused: the wall dims and a placard offers the way out. Blocks all touches below. */
export function PauseOverlay({ label, onResume, onRestart, onLevels, onHome, onSettings }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.layer}>
      <View style={styles.card}>
        <Text style={styles.small}>{label}</Text>
        <Text style={styles.title}>Paused</Text>
        <View style={styles.buttons}>
          <MenuButton variant="primary" icon="play" label="Resume" onPress={onResume} />
          <MenuButton icon="refresh" label="Restart level" onPress={onRestart} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <MenuButton icon="home-outline" label="Home" onPress={onHome} />
            </View>
            <View style={{ flex: 1 }}>
              <MenuButton icon="grid-outline" label="Levels" onPress={onLevels} />
            </View>
          </View>
          <MenuButton icon="settings-outline" label="Settings" onPress={onSettings} />
          {CAN_EXIT && <MenuButton icon="exit-outline" label="Exit game" onPress={confirmExit} />}
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
  row: { flexDirection: 'row', gap: 10 },
});
