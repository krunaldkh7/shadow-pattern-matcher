import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../game/constants';
import { GameEngine } from '../../game/GameEngine';
import { useGameUI } from '../../hooks/useGameUI';
import { useRotationGestures } from '../../hooks/useRotationGestures';
import { GameScene } from '../../three/GameScene';
import { ControlBar } from '../components/ControlBar';
import { DragHint } from '../components/DragHint';
import { Header } from '../components/Header';
import { LevelCompleteOverlay } from '../components/LevelCompleteOverlay';

/**
 * Composition root for one play session.
 * The 3D canvas fills the screen and owns all touch input; the HUD floats on
 * top with pointerEvents="box-none" so only its buttons intercept touches.
 */
export function GameScreen() {
  const [engine] = useState(() => new GameEngine(0));
  const ui = useGameUI(engine);
  const gesture = useRotationGestures(engine);
  const insets = useSafeAreaInsets();
  const playing = ui.status === 'playing';

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <GameScene engine={engine} />
        </View>
      </GestureDetector>

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Header
          levelNumber={ui.levelNumber}
          accuracy={ui.accuracy}
          solved={!playing}
          hintDisabled={!playing}
          onLightbulb={() => engine.autoRotateHint()}
        />
      </View>

      <View pointerEvents="none" style={styles.hintZone}>
        <DragHint visible={!ui.interacted && playing} />
      </View>

      {ui.status !== 'complete' && (
        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
          <ControlBar
            canUndo={ui.canUndo}
            disabled={!playing}
            ghostActive={ui.ghostVisible}
            onUndo={() => engine.undo()}
            onReset={() => engine.reset()}
            onHint={() => engine.showGhost()}
          />
        </View>
      )}

      {ui.status === 'complete' && (
        <LevelCompleteOverlay
          levelNumber={ui.levelNumber}
          shapeName={ui.shapeName}
          bulbsLeft={ui.bulbsLeft}
          hintsUsed={ui.hintsUsed}
          solveSeconds={ui.solveSeconds}
          bottomInset={insets.bottom}
          onNext={() => engine.nextLevel()}
          onReplay={() => engine.replayLevel()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  hintZone: { position: 'absolute', left: 0, right: 0, bottom: '17%', alignItems: 'center' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
