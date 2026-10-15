/**
 * Line drawings of real Fremont places, used in headers and empty states. Each one is its own
 * script, loaded only when a screen shows it, so none of them adds to the first page load. Until
 * it arrives the space is held open at its final size, so nothing below it moves.
 * All three are decorative and hidden from screen readers.
 */
import { lazy, Suspense } from 'react';
import { View } from 'react-native';

const SCENES = {
  peak: lazy(() => import('./MissionPeak')),
  niles: lazy(() => import('./NilesHill')),
  lake: lazy(() => import('./LakeElizabeth')),
};
export type SceneName = keyof typeof SCENES;

export function Illustration({ name, width, height }: { name: SceneName; width: number; height: number }) {
  const Scene = SCENES[name];
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height }} testID={`art-${name}`}>
      <Suspense fallback={null}>
        <Scene width={width} height={height} />
      </Suspense>
    </View>
  );
}
