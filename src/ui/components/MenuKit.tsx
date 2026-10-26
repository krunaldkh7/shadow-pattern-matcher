import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, INK } from '../theme';

/** The sand tile of the 3D wall, flat: menus are written on the same wall as the game. */
export const WALL = '#d6c0a4';

interface ScreenProps {
  title?: string;
  /** Show the back arrow (every screen except Home). */
  back?: boolean;
  scroll?: boolean;
  children: ReactNode;
}

export function MenuScreen({ title, back = true, scroll = true, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = (
    <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>{children}</View>
  );
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      {(back || title) && (
        <View style={styles.bar}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={styles.back}
            >
              <Ionicons name="chevron-back" size={26} color={INK.ink} />
            </Pressable>
          ) : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      )}
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{body}</ScrollView> : body}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  icon?: keyof typeof Ionicons.glyphMap;
  sublabel?: string;
}

export function MenuButton({ label, onPress, variant = 'secondary', icon, sublabel }: ButtonProps) {
  const primary = variant === 'primary';
  const color = primary ? INK.paper : INK.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        pressed && (primary ? styles.primaryPressed : styles.secondaryPressed),
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={color} /> : null}
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.buttonText, { color }]}>{label}</Text>
        {sublabel ? <Text style={[styles.sublabel, { color: primary ? 'rgba(239,228,204,0.7)' : INK.inkSoft }]}>{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WALL },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48, gap: 6 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  title: { fontFamily: FONT.title, fontSize: 24, color: INK.ink },
  body: { flex: 1, paddingHorizontal: 20 },
  button: {
    minHeight: 56,
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  primary: { backgroundColor: INK.ink },
  primaryPressed: { backgroundColor: '#2c2018' },
  secondary: { borderWidth: 1.5, borderColor: INK.ink, backgroundColor: 'rgba(239,228,204,0.32)' },
  secondaryPressed: { backgroundColor: 'rgba(59,43,32,0.14)' },
  buttonText: { fontFamily: FONT.label, fontSize: 17 },
  sublabel: { fontFamily: FONT.body, fontSize: 13, marginTop: 1 },
});
