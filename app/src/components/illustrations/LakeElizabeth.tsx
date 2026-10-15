import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { ART } from './palette';

/**
 * Lake Elizabeth in Central Park on a still day, with Mission Peak behind it and a pair of
 * geese on the water. Decorative.
 */
export default function LakeElizabeth({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 240 140" aria-hidden>
      <Circle cx={54} cy={34} r={11} fill={ART.sunFill} stroke={ART.sun} strokeWidth={1.5} />
      <Path d="M0 84 C30 78 62 72 96 64 C118 58 136 48 150 38 L156 34 L161 39 C176 50 200 62 240 70 L240 140 L0 140 Z" fill={ART.sky} stroke={ART.ink} strokeWidth={1.5} strokeLinejoin="round" />
      <Line x1={156} y1={34} x2={156} y2={27} stroke={ART.ink} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M0 92 C40 86 80 90 120 88 C160 86 200 84 240 88 L240 140 L0 140 Z" fill={ART.hill} stroke={ART.ink} strokeWidth={1.2} />
      {/* The lake. */}
      <Path d="M18 104 C60 96 180 96 222 104 C232 114 210 126 120 128 C40 126 8 116 18 104 Z" fill={ART.water} stroke={ART.ink} strokeWidth={1.2} />
      <G stroke={ART.ink} strokeWidth={0.9} strokeLinecap="round">
        <Line x1={44} y1={110} x2={70} y2={110} />
        <Line x1={150} y1={116} x2={186} y2={116} />
        <Line x1={92} y1={120} x2={110} y2={120} />
      </G>
      {/* Two geese. */}
      <G fill={ART.white} stroke={ART.ink} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round">
        <Path d="M112 110 C112 106 118 104 124 106 L128 106 C128 101 129 98 132 98 C134 98 135 99 136 100 L133 101 C132 104 132 107 130 110 Z" />
        <Path d="M140 113 C140 110 145 108 150 110 L153 110 C153 106 154 104 156 104 C158 104 159 105 160 106 L157 107 C156 109 156 111 155 113 Z" />
      </G>
      {/* Reeds at the near shore. */}
      <G stroke={ART.ink} strokeWidth={1} strokeLinecap="round" fill="none">
        <Path d="M200 128 C199 120 197 114 194 110" />
        <Path d="M205 128 C205 118 206 112 208 108" />
        <Path d="M210 129 C211 122 214 117 218 114" />
      </G>
      <Line x1={0} y1={139.5} x2={240} y2={139.5} stroke={ART.ink} strokeWidth={1} />
    </Svg>
  );
}
