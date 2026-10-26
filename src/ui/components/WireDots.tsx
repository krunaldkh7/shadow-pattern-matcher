import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { resampleStroke, type ShapeDef } from '../../game/shapes';
import { INK } from '../theme';

/**
 * A shape drawn as gold dots floating at random depths. Rotated by yaw/pitch
 * it reads as a scramble; at yaw = pitch = 0 the dots line up into the shape —
 * the game's idea in miniature. Used by the intro and the Home teaser.
 */

export interface Dot {
  x: number;
  y: number;
  z: number;
}

export function buildDots(shape: ShapeDef, spacing = 0.13, seed = 7): Dot[] {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return shape.strokes.flatMap((st) =>
    resampleStroke(st, spacing).map(([x, y]) => ({ x, y, z: (rand() * 2 - 1) * 0.9 })),
  );
}

interface Props {
  dots: Dot[];
  yaw: SharedValue<number>;
  pitch: SharedValue<number>;
  /** 0..1: brighter, larger dots when matched. */
  glow?: SharedValue<number>;
  /** Pixels per shape unit. */
  size: number;
  dotSize?: number;
  /** Faint dotted target outline behind the dots. */
  showTarget?: boolean;
}

export function WireDots({ dots, yaw, pitch, glow, size, dotSize = 10, showTarget }: Props) {
  return (
    <View style={styles.stage} pointerEvents="none">
      {showTarget &&
        dots.map((d, i) => (
          <View
            key={`t${i}`}
            style={[styles.target, { transform: [{ translateX: d.x * size }, { translateY: -d.y * size }] }]}
          />
        ))}
      {dots.map((d, i) => (
        <SpinningDot key={i} dot={d} yaw={yaw} pitch={pitch} glow={glow} size={size} dotSize={dotSize} />
      ))}
    </View>
  );
}

function SpinningDot({
  dot,
  yaw,
  pitch,
  glow,
  size,
  dotSize,
}: {
  dot: Dot;
  yaw: SharedValue<number>;
  pitch: SharedValue<number>;
  glow?: SharedValue<number>;
  size: number;
  dotSize: number;
}) {
  const style = useAnimatedStyle(() => {
    const a = yaw.value;
    const b = pitch.value;
    const g = glow ? glow.value : 0;
    // Rotate about Y, then X; orthographic projection onto the wall.
    const x1 = dot.x * Math.cos(a) + dot.z * Math.sin(a);
    const z1 = -dot.x * Math.sin(a) + dot.z * Math.cos(a);
    const y2 = dot.y * Math.cos(b) - z1 * Math.sin(b);
    const z2 = dot.y * Math.sin(b) + z1 * Math.cos(b);
    const depth = 1 + z2 * 0.25; // nearer dots draw a little larger
    return {
      transform: [{ translateX: x1 * size }, { translateY: -y2 * size }, { scale: depth * (1 + g * 0.35) }],
      backgroundColor: g > 0.5 ? INK.bulbLit : INK.brass,
    };
  });
  return (
    <Animated.View
      style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, marginLeft: -dotSize / 2, marginTop: -dotSize / 2 }, style]}
    />
  );
}

const styles = StyleSheet.create({
  stage: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  target: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: INK.inkFaint },
  dot: { position: 'absolute', left: '50%', top: '50%' },
});
