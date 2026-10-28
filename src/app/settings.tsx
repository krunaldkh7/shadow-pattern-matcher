import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { progress, useProgress } from '../game/progress';
import { skipNextAppOpen } from '../ads/googleAds';
import { LEGAL_LINKS } from '../legal';
import { MenuButton, MenuScreen } from '../ui/components/MenuKit';
import { FONT, INK } from '../ui/theme';

export default function Settings() {
  const state = useProgress();

  const confirmReset = () =>
    Alert.alert('Reset progress?', 'All solved levels and bulbs will be erased. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => progress.reset() },
    ]);

  return (
    <MenuScreen title="Settings">
      <Section title="Feel">
        <Row label="Vibration" detail="Taps, snaps and success buzz">
          <Switch
            value={state.hapticsEnabled}
            onValueChange={(v) => progress.setHaptics(v)}
            trackColor={{ true: INK.ink, false: INK.inkFaint }}
            thumbColor={INK.paper}
            accessibilityLabel="Vibration"
          />
        </Row>
      </Section>

      <Section title="Help">
        <MenuButton icon="help-circle-outline" label="How to play" onPress={() => router.push('/how-to-play')} />
      </Section>

      <Section title="About & legal">
        <MenuButton icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => open(LEGAL_LINKS.privacyPolicy)} />
        <MenuButton icon="document-text-outline" label="Terms of Use" onPress={() => open(LEGAL_LINKS.termsOfUse)} />
        <MenuButton icon="chatbubble-ellipses-outline" label="Support" onPress={() => open(LEGAL_LINKS.support)} />
        <MenuButton
          icon="mail-outline"
          label="Contact us"
          sublabel={LEGAL_LINKS.supportEmail}
          onPress={() => open(`mailto:${LEGAL_LINKS.supportEmail}`)}
        />
      </Section>

      <Section title="Progress">
        <MenuButton icon="trash-outline" label="Reset progress" onPress={confirmReset} />
      </Section>

      <Text style={styles.version}>
        {Constants.expoConfig?.name} · version {Constants.expoConfig?.version}
      </Text>
    </MenuScreen>
  );
}

/** Open an external link; a missing browser/mail app just shows a note instead of throwing. */
function open(url: string) {
  skipNextAppOpen();
  Linking.openURL(url).catch(() => Alert.alert('Could not open link', url));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, detail, children }: { label: string; detail: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, gap: 10 },
  sectionTitle: { fontFamily: FONT.label, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: INK.inkSoft },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: INK.inkFaint,
  },
  label: { fontFamily: FONT.label, fontSize: 17, color: INK.ink },
  detail: { fontFamily: FONT.body, fontSize: 14, color: INK.inkSoft, marginTop: 2 },
  version: { fontFamily: FONT.body, fontSize: 13, color: INK.inkSoft, textAlign: 'center', marginTop: 36 },
});
