import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONT, INK } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IconName;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  /** Filled ink — used while a toggle (the ghost hint) is on. */
  active?: boolean;
  size?: number;
  accessibilityLabel: string;
}

/**
 * An ink ring drawn on the wall. No fill, no glow: it reads like the dotted
 * target outline's solid cousin. Pressed state darkens the ring instead of
 * bouncing, the way a mark would under a fingertip.
 */
export function IconButton({ icon, label, onPress, disabled, active, size = 50, accessibilityLabel }: Props) {
  const color = active ? INK.paper : disabled ? INK.inkFaint : INK.ink;
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, selected: active }}
        disabled={disabled}
        onPress={onPress}
        hitSlop={10}
        style={({ pressed }) => [
          styles.ring,
          { width: size, height: size, borderRadius: size / 2 },
          disabled && styles.ringDisabled,
          active && styles.ringActive,
          pressed && !active && styles.ringPressed,
        ]}
      >
        <Ionicons name={icon} size={size * 0.42} color={color} />
      </Pressable>
      {label ? <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 5 },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: INK.ink,
    backgroundColor: 'rgba(239,228,204,0.32)',
  },
  ringDisabled: { borderColor: INK.inkFaint, backgroundColor: 'transparent' },
  ringActive: { backgroundColor: INK.ink },
  ringPressed: { backgroundColor: 'rgba(59,43,32,0.14)' },
  label: { fontFamily: FONT.label, fontSize: 14, color: INK.ink },
  labelDisabled: { color: INK.inkFaint },
});
