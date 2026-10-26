import { Redirect, useLocalSearchParams } from 'expo-router';
import { LEVEL_COUNT } from '../../game/levels';
import { useProgress } from '../../game/progress';
import { GameScreen } from '../../ui/screens/GameScreen';

export default function Play() {
  const { level } = useLocalSearchParams<{ level: string }>();
  const { unlocked } = useProgress();
  const index = Number(level);

  if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT || index > unlocked) {
    return <Redirect href="/levels" />;
  }
  // Remount the engine when the route's level changes.
  return <GameScreen key={index} startLevel={index} />;
}
