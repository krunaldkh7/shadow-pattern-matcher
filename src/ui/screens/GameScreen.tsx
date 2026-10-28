import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdBanner } from '../../ads/AdBanner';
import { BonusOffer } from '../../ads/BonusOffer';
import {
  onLevelSolvedNavigate,
  setInGame,
  showRewarded,
  useRewardedAvailable,
  useRewardedInterstitialReady,
} from '../../ads/googleAds';
import { COLORS } from '../../game/constants';
import { GameEngine } from '../../game/GameEngine';
import { customLevels, toShape, type CustomLevel } from '../../game/customLevels';
import { progress } from '../../game/progress';
import { tierOf } from '../../game/tiers';
import { useGameUI } from '../../hooks/useGameUI';
import { useHintAccess } from '../../hooks/useHintAccess';
import { useRotationGestures } from '../../hooks/useRotationGestures';
import { GameScene } from '../../three/GameScene';
import { ControlBar } from '../components/ControlBar';
import { DragHint } from '../components/DragHint';
import { Header } from '../components/Header';
import { LevelCompleteOverlay } from '../components/LevelCompleteOverlay';
import { PauseOverlay } from '../components/PauseOverlay';

/** Height of the Undo / Reset / Hint row, so the drag hint sits just above it. */
const CONTROLS_HEIGHT = 96;

/**
 * Composition root for one play session.
 * The 3D canvas fills the screen and owns all touch input; the HUD floats on
 * top with pointerEvents="box-none" so only its buttons intercept touches.
 */
export function GameScreen({ startLevel, custom }: { startLevel: number; custom?: CustomLevel }) {
  const [engine] = useState(() => new GameEngine(startLevel, custom ? toShape(custom) : undefined));
  const ui = useGameUI(engine);
  const hint = useHintAccess(engine, ui);
  const gesture = useRotationGestures(engine);
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);

  // While this screen is focused, taps don't count toward interstitials and none can open.
  useFocusEffect(
    useCallback(() => {
      setInGame(true);
      return () => setInGame(false);
    }, []),
  );
  // Rewarded-interstitial bonus on the solved card: offered once per solve when bulbs were spent.
  const bonusReady = useRewardedInterstitialReady();
  const [bonus, setBonus] = useState<{ level: number; state: 'offer' | 'done' | 'earned' }>({ level: 0, state: 'done' });
  const bonusForThis = bonus.level === ui.levelNumber ? bonus.state : null;
  const playing = ui.status === 'playing';
  const levelIndex = ui.levelNumber - 1;
  const label = custom ? custom.name : `No. ${ui.levelNumber}`;
  // Where "Levels" / "All levels" lead: the level's gallery, or the player's own list.
  const menuHref = custom ? '/my-levels' : `/tier/${tierOf(levelIndex).id}`;

  // Save the result once per solve (status flips to 'success' at the snap).
  useEffect(() => {
    if (ui.status !== 'success') return;
    if (custom) customLevels.recordWin(custom.id, ui.stars, ui.solveSeconds);
    else progress.recordWin(levelIndex, ui.stars, ui.solveSeconds);
  }, [ui.status, levelIndex, ui.stars, ui.solveSeconds, custom]);

  // Offer the bonus once the card is up, only if bulbs were spent and an ad is ready.
  useEffect(() => {
    if (!custom && ui.status === 'complete' && bonusForThis === null && ui.bulbsLeft < 3 && bonusReady) {
      setBonus({ level: ui.levelNumber, state: 'offer' });
    }
  }, [custom, ui.status, ui.levelNumber, ui.bulbsLeft, bonusReady, bonusForThis]);

  const earnBonus = useCallback(() => {
    progress.recordWin(levelIndex, 3, ui.solveSeconds);
    setBonus((b) => ({ ...b, state: 'earned' }));
  }, [levelIndex, ui.solveSeconds]);
  const endBonus = useCallback(() => setBonus((b) => (b.state === 'offer' ? { ...b, state: 'done' } : b)), []);

  const pause = () => {
    engine.pause();
    setPaused(true);
  };

  // Skip: watch a reward video to mark this gallery level skipped and move on.
  const skipAvailable = useRewardedAvailable() && !custom;
  const [skipping, setSkipping] = useState(false);
  const skipLevel = () => {
    if (!playing || skipping) return;
    Alert.alert('Skip this level?', 'Watch a short video to skip it. It stays open to solve later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Watch video',
        onPress: async () => {
          setSkipping(true);
          engine.pause();
          const result = await showRewarded();
          engine.resume();
          setSkipping(false);
          if (result === 'earned') {
            progress.recordSkip(levelIndex);
            if (engine.isLastLevel) router.dismissTo(menuHref);
            else engine.nextLevel();
          } else if (result === 'unavailable') {
            Alert.alert('No video right now', 'A video couldn’t be loaded. Check your connection and try again in a moment.');
          }
        },
      },
    ]);
  };
  const resume = () => {
    engine.resume();
    setPaused(false);
  };

  // The solve clock only runs while the app is on screen: stop it in the
  // background and restart it on return, unless the player had paused.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') engine.pause();
      else if (state === 'active' && !pausedRef.current) engine.resume();
    });
    return () => sub.remove();
  }, [engine]);

  // Android back: opens the pause menu (or closes it) instead of dropping the level.
  // Once the level is solved, back leaves to the gallery as usual.
  const statusRef = useRef(ui.status);
  statusRef.current = ui.status;
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (statusRef.current === 'complete') return false;
        if (pausedRef.current) {
          engine.resume();
          setPaused(false);
        } else {
          engine.pause();
          setPaused(true);
        }
        return true;
      });
      return () => sub.remove();
    }, [engine]),
  );

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <GameScene engine={engine} />
        </View>
      </GestureDetector>

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Header
          label={label}
          accuracy={ui.accuracy}
          solved={!playing}
          hintDisabled={!playing || hint.busy}
          onLightbulb={hint.lightbulb}
          hintMode={hint.bulbMode}
          bulbsLeft={bonusForThis === 'earned' ? 3 : ui.bulbsLeft}
          onPause={pause}
        />
      </View>

      <View pointerEvents="none" style={[styles.hintZone, { bottom: insets.bottom + 14 + bannerHeight + CONTROLS_HEIGHT }]}>
        <DragHint visible={!ui.interacted && playing} />
      </View>

      {ui.status !== 'complete' && (
        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 14 + bannerHeight }]}>
          <ControlBar
            canUndo={ui.canUndo}
            disabled={!playing}
            ghostActive={ui.ghostVisible}
            onUndo={() => engine.undo()}
            onReset={() => engine.reset()}
            onHint={hint.ghost}
            hintMode={hint.busy ? 'none' : hint.ghostMode}
            hintsLeft={ui.ghostsLeft}
            onSkip={skipAvailable ? skipLevel : undefined}
            skipDisabled={hint.busy || skipping}
          />
        </View>
      )}

      {ui.status === 'complete' && (
        <LevelCompleteOverlay
          label={label}
          finishLabel={custom ? 'Back to my levels' : undefined}
          shapeName={ui.shapeName}
          bulbsLeft={bonusForThis === 'earned' ? 3 : ui.bulbsLeft}
          hintsUsed={ui.hintsUsed}
          solveSeconds={ui.solveSeconds}
          bottomInset={insets.bottom + bannerHeight}
          isLast={engine.isLastLevel}
          onNext={() => {
            onLevelSolvedNavigate();
            engine.nextLevel();
          }}
          onReplay={() => engine.replayLevel()}
          onMenu={() => router.dismissTo(menuHref)}
        />
      )}

      {/* The bonus offer floats under the header, apart from the solved card, so the card's buttons never move. */}
      {ui.status === 'complete' && bonusForThis === 'offer' && (
        <View pointerEvents="box-none" style={[styles.bonus, { top: insets.top + 96 }]}>
          <BonusOffer onEarned={earnBonus} onDone={endBonus} />
        </View>
      )}

      {/* Always-on banner along the bottom edge; the controls and the solved card sit above it. */}
      <View pointerEvents="box-none" style={[styles.banner, { paddingBottom: insets.bottom }]}>
        <AdBanner onHeight={setBannerHeight} />
      </View>

      {paused && (
        <PauseOverlay
          label={label}
          onResume={resume}
          onRestart={() => {
            engine.replayLevel();
            setPaused(false);
          }}
          onLevels={() => router.dismissTo(menuHref)}
          onHome={() => router.dismissTo('/')}
          onSettings={() => router.push('/settings')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  hintZone: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  banner: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bonus: { position: 'absolute', left: 30, right: 30, alignItems: 'center' },
});
