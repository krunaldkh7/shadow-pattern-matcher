import { router } from 'expo-router';
import { progress } from '../game/progress';

/** Open a level; the very first one goes through How to play first. */
export function openLevel(index: number) {
  if (!progress.get().seenTutorial) {
    progress.markTutorialSeen();
    router.push({ pathname: '/how-to-play', params: { then: String(index) } });
    return;
  }
  router.push(`/play/${index}`);
}
