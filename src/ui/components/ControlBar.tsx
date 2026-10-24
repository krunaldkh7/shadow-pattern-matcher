import { StyleSheet, View } from 'react-native';
import { IconButton } from './IconButton';

interface Props {
  canUndo: boolean;
  disabled: boolean;
  ghostActive: boolean;
  onUndo: () => void;
  onReset: () => void;
  onHint: () => void;
}

/** Bottom controls: Undo last gesture · Reset level · Hint (ghost alignment guide). */
export function ControlBar({ canUndo, disabled, ghostActive, onUndo, onReset, onHint }: Props) {
  return (
    <View style={styles.row}>
      <IconButton
        icon="arrow-undo"
        label="Undo"
        onPress={onUndo}
        disabled={disabled || !canUndo}
        accessibilityLabel="Undo last rotation"
      />
      <IconButton
        icon="refresh"
        label="Reset"
        onPress={onReset}
        disabled={disabled}
        accessibilityLabel="Reset level to starting rotation"
      />
      <IconButton
        icon={ghostActive ? 'eye' : 'eye-outline'}
        label="Hint"
        onPress={onHint}
        disabled={disabled}
        active={ghostActive}
        accessibilityLabel="Show the solved pose as a ghost guide"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start', paddingHorizontal: 24 },
});
