import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { ART } from './palette';

/**
 * Mission Peak seen from the flats of Fremont: the long ridge rising from the north, the sharp
 * summit with its sighting post, and oak-dotted foothills in front. Decorative.
 */
export default function MissionPeak({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 100" aria-hidden>
      <Circle cx={318} cy={30} r={11} fill={ART.sunFill} stroke={ART.sun} strokeWidth={1.5} />
      {/* The range: a long climb from the left, the summit, then a gentler fall to the south. */}
      <Path
        d="M0 74 C36 68 70 63 104 58 C140 53 170 46 196 38 C214 32 230 25 242 17 L250 12 L258 19 C272 28 290 36 314 43 C342 51 372 57 400 61 L400 100 L0 100 Z"
        fill={ART.sky} stroke={ART.ink} strokeWidth={1.5} strokeLinejoin="round"
      />
      {/* The summit post. */}
      <Line x1={250} y1={12} x2={250} y2={2} stroke={ART.ink} strokeWidth={1.5} strokeLinecap="round" />
      <Rect x={247} y={1} width={6} height={3} rx={1} fill={ART.ink} />
      {/* A trail switching back up the west face. */}
      <Path d="M206 70 L224 58 L212 50 L232 38 L222 31 L244 20" fill="none" stroke={ART.ink} strokeWidth={0.8} strokeDasharray="2 3" strokeLinecap="round" />
      {/* Foothills. */}
      <Path d="M0 86 C50 76 96 80 140 78 C186 76 222 70 262 74 C306 78 352 88 400 82 L400 100 L0 100 Z" fill={ART.hill} stroke={ART.ink} strokeWidth={1.2} strokeLinejoin="round" />
      <G fill={ART.hillDeep} stroke={ART.ink} strokeWidth={1}>
        {[[52, 80, 1], [70, 81, 0.8], [160, 77, 1.1], [182, 76, 0.8], [300, 79, 1], [352, 85, 0.9]].map(([x, y, s]) => (
          <G key={`${x}-${y}`}>
            <Line x1={x} y1={y} x2={x} y2={y - 5 * s} strokeLinecap="round" />
            <Circle cx={x - 3 * s} cy={y - 7 * s} r={4 * s} />
            <Circle cx={x + 3 * s} cy={y - 8 * s} r={4.5 * s} />
          </G>
        ))}
      </G>
      <Line x1={0} y1={99.5} x2={400} y2={99.5} stroke={ART.ink} strokeWidth={1} />
    </Svg>
  );
}
