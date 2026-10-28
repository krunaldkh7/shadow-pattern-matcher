import { StyleSheet, View } from 'react-native';
import type { HintMode } from '../../hooks/useHintAccess';
import { IconButton } from './IconButton';

interface Props {
  canUndo: boolean;
  disabled: boolean;
  ghostActive: boolean;
  hintMode: HintMode;
  /** Free ghost hints left this level. */
  hintsLeft: number;
  onUndo: () => void;
  onReset: () => void;
  onHint: () => void;
}

/** Bottom controls: Undo last gesture · Reset level · Hint (ghost alignment guide). */
export function ControlBar({ canUndo, disabled, ghostActive, hintMode, hintsLeft, onUndo, onReset, onHint }: Props) {
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
        icon={hintMode === 'ad' ? 'play-circle-outline' : ghostActive ? 'eye' : 'eye-outline'}
        label={hintMode === 'ad' ? 'Watch ad' : `Hint ${hintsLeft}/3`}
        onPress={onHint}
        disabled={disabled || hintMode === 'none'}
        active={ghostActive}
        accessibilityLabel={hintMode === 'ad' ? 'Watch an ad to see the solved pose' : 'Show the solved pose as a ghost guide, costs one bulb'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start', paddingHorizontal: 24 },
});
