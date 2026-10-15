import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { ART } from './palette';

/** Block capitals for the sign, each drawn on a 10 x 14 grid as stroked lines. */
const LETTERS: Record<string, string> = {
  N: 'M0 14 V0 L10 14 V0',
  I: 'M5 0 V14 M1 0 H9 M1 14 H9',
  L: 'M1 0 V14 H10',
  E: 'M10 0 H1 V14 H10 M1 7 H8',
  S: 'M10 1 C7 -0.5 1 -0.5 1 3.5 C1 7.5 10 6.5 10 10.5 C10 14.5 3 14.5 0 13',
};

/**
 * The hillside above Niles with its big white NILES letters, Alameda Creek running out of the
 * canyon, and the old railroad line along its bank. Decorative.
 */
export default function NilesHill({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 240 140" aria-hidden>
      <Circle cx={196} cy={30} r={12} fill={ART.sunFill} stroke={ART.sun} strokeWidth={1.5} />
      <Path d="M0 96 C30 70 62 52 100 46 C138 40 170 52 200 70 C218 81 230 90 240 94 L240 140 L0 140 Z" fill={ART.sky} stroke={ART.ink} strokeWidth={1.5} strokeLinejoin="round" />
      {/* The sign: five white letters with a dark edge, stepping along the slope. */}
      {[{ stroke: ART.ink, width: 6 }, { stroke: ART.white, width: 3 }].map((pass) => (
        <G key={pass.stroke} fill="none" stroke={pass.stroke} strokeWidth={pass.width} strokeLinecap="square" strokeLinejoin="miter">
          {['N', 'I', 'L', 'E', 'S'].map((letter, i) => (
            <Path key={letter} d={LETTERS[letter]} transform={`translate(${58 + i * 23} ${57 + Math.abs(i - 1.8) * 3})`} />
          ))}
        </G>
      ))}
      {/* Foreground bank, creek and rails. */}
      <Path d="M0 112 C40 104 90 108 130 106 C170 104 206 100 240 104 L240 140 L0 140 Z" fill={ART.hill} stroke={ART.ink} strokeWidth={1.2} />
      <Path d="M0 126 C50 120 96 128 140 124 C180 120 210 126 240 122" fill="none" stroke={ART.ink} strokeWidth={1.2} />
      <Path d="M20 131 C60 127 100 133 150 130" fill="none" stroke={ART.ink} strokeWidth={0.8} strokeDasharray="4 4" />
      <Line x1={0} y1={114} x2={240} y2={110} stroke={ART.ink} strokeWidth={1} />
      <Line x1={0} y1={117} x2={240} y2={113} stroke={ART.ink} strokeWidth={1} />
      <G stroke={ART.ink} strokeWidth={1}>
        {Array.from({ length: 16 }, (_, i) => <Line key={i} x1={6 + i * 15} y1={113.8 - i * 0.25} x2={6 + i * 15} y2={118 - i * 0.25} />)}
      </G>
      <Rect x={0} y={139} width={240} height={1} fill={ART.ink} />
    </Svg>
  );
}
