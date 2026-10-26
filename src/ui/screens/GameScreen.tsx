import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../game/constants';
import { GameEngine } from '../../game/GameEngine';
import { progress } from '../../game/progress';
import { useGameUI } from '../../hooks/useGameUI';
import { useRotationGestures } from '../../hooks/useRotationGestures';
import { GameScene } from '../../three/GameScene';
import { ControlBar } from '../components/ControlBar';
import { DragHint } from '../components/DragHint';
import { Header } from '../components/Header';
import { LevelCompleteOverlay } from '../components/LevelCompleteOverlay';
import { PauseOverlay } from '../components/PauseOverlay';

/**
 * Composition root for one play session.
 * The 3D canvas fills the screen and owns all touch input; the HUD floats on
 * top with pointerEvents="box-none" so only its buttons intercept touches.
 */
export function GameScreen({ startLevel }: { startLevel: number }) {
  const [engine] = useState(() => new GameEngine(startLevel));
  const ui = useGameUI(engine);
  const gesture = useRotationGestures(engine);
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(false);
  const playing = ui.status === 'playing';
  const levelIndex = ui.levelNumber - 1;

  // Save the result once per solve (status flips to 'success' at the snap).
  useEffect(() => {
    if (ui.status === 'success') progress.recordWin(levelIndex, ui.stars, ui.solveSeconds);
  }, [ui.status, levelIndex, ui.stars, ui.solveSeconds]);

  const pause = () => {
    engine.pause();
    setPaused(true);
  };
  const resume = () => {
    engine.resume();
    setPaused(false);
  };

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
          onPause={pause}
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
          isLast={engine.isLastLevel}
          onNext={() => engine.nextLevel()}
          onReplay={() => engine.replayLevel()}
          onMenu={() => router.replace('/levels')}
        />
      )}

      {paused && (
        <PauseOverlay
          levelNumber={ui.levelNumber}
          onResume={resume}
          onRestart={() => {
            engine.replayLevel();
            setPaused(false);
          }}
          onLevels={() => router.replace('/levels')}
          onSettings={() => router.push('/settings')}
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
