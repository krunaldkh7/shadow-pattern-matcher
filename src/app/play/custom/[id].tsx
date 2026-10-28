import { Redirect, useLocalSearchParams } from 'expo-router';
import { customLevels } from '../../../game/customLevels';
import { GameScreen } from '../../../ui/screens/GameScreen';

/** Play one of the player's own levels. */
export default function PlayCustom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const level = id ? customLevels.find(id) : undefined;
  if (!level) return <Redirect href="/my-levels" />;
  return <GameScreen key={level.id} startLevel={0} custom={level} />;
}
