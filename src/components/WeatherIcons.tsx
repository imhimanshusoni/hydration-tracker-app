// Custom SVG weather icons for the hydration app weather card.
// All icons use a 48x48 viewBox and accept an optional size prop.

import React from 'react';
import Svg, { Circle, Ellipse, Path, Line, G } from 'react-native-svg';

// ---------------------------------------------------------------------------
// SunIcon — amber circle with 8 short radiating rays
// ---------------------------------------------------------------------------
export function SunIcon({ size = 48 }: { size?: number }) {
  const cx = 24;
  const cy = 24;
  const coreR = 9;
  // 8 rays evenly spaced, starting at 0°
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 * Math.PI) / 180;
    const innerR = coreR + 3;
    const outerR = coreR + 7;
    return {
      x1: cx + innerR * Math.cos(angle),
      y1: cy + innerR * Math.sin(angle),
      x2: cx + outerR * Math.cos(angle),
      y2: cy + outerR * Math.sin(angle),
    };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {rays.map((r, i) => (
        <Line
          key={i}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke="#F5BB70"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ))}
      <Circle cx={cx} cy={cy} r={coreR} fill="#F0A050" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// CloudIcon — three overlapping ellipses forming a cloud silhouette
// ---------------------------------------------------------------------------
export function CloudIcon({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Base body */}
      <Ellipse cx={24} cy={29} rx={14} ry={8} fill="#7A8BA8" />
      {/* Left dome */}
      <Ellipse cx={16} cy={25} rx={8} ry={7} fill="#7A8BA8" />
      {/* Right dome */}
      <Ellipse cx={30} cy={24} rx={9} ry={8} fill="#7A8BA8" />
      {/* Centre top dome — creates the classic rounded peak */}
      <Ellipse cx={23} cy={22} rx={7} ry={6.5} fill="#7A8BA8" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// PartlyCloudyIcon — small amber sun peeking from behind a gray cloud
// ---------------------------------------------------------------------------
export function PartlyCloudyIcon({ size = 48 }: { size?: number }) {
  // Sun centre (upper-left of cloud)
  const sx = 17;
  const sy = 19;
  const sunR = 6;
  // 6 rays
  const rays = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 * Math.PI) / 180;
    const innerR = sunR + 2;
    const outerR = sunR + 5;
    return {
      x1: sx + innerR * Math.cos(angle),
      y1: sy + innerR * Math.sin(angle),
      x2: sx + outerR * Math.cos(angle),
      y2: sy + outerR * Math.sin(angle),
    };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Sun rays behind cloud */}
      <G opacity={0.9}>
        {rays.map((r, i) => (
          <Line
            key={i}
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            stroke="#F5BB70"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        <Circle cx={sx} cy={sy} r={sunR} fill="#F0A050" />
      </G>
      {/* Cloud in front */}
      {/* Base body */}
      <Ellipse cx={28} cy={33} rx={13} ry={7} fill="#7A8BA8" />
      {/* Left dome */}
      <Ellipse cx={20} cy={29} rx={7} ry={6} fill="#7A8BA8" />
      {/* Right dome */}
      <Ellipse cx={32} cy={28} rx={8.5} ry={7.5} fill="#7A8BA8" />
      {/* Centre top dome */}
      <Ellipse cx={27} cy={26} rx={6.5} ry={6} fill="#7A8BA8" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// RainIcon — cloud with 3 diagonal rain drops below
// ---------------------------------------------------------------------------
export function RainIcon({ size = 48 }: { size?: number }) {
  // Drop positions: (x1,y1) top of drop streak → (x2,y2) bottom
  const drops = [
    { x1: 16, y1: 36, x2: 13, y2: 44 },
    { x1: 24, y1: 36, x2: 21, y2: 44 },
    { x1: 32, y1: 36, x2: 29, y2: 44 },
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Cloud */}
      <Ellipse cx={24} cy={24} rx={14} ry={7} fill="#7A8BA8" />
      <Ellipse cx={16} cy={20} rx={8} ry={7} fill="#7A8BA8" />
      <Ellipse cx={30} cy={19} rx={9} ry={8} fill="#7A8BA8" />
      <Ellipse cx={23} cy={17} rx={7} ry={6.5} fill="#7A8BA8" />
      {/* Rain drops */}
      {drops.map((d, i) => (
        <Line
          key={i}
          x1={d.x1}
          y1={d.y1}
          x2={d.x2}
          y2={d.y2}
          stroke="#3B9FE3"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// ThunderstormIcon — cloud with a zigzag lightning bolt below
// ---------------------------------------------------------------------------
export function ThunderstormIcon({ size = 48 }: { size?: number }) {
  // Lightning bolt: zigzag centred at x≈24
  // Points: top-right → mid-left → mid-right → bottom-left
  const boltPath = 'M 27 33 L 21 40 L 25 40 L 19 47 L 29 39 L 25 39 Z';

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Cloud — shifted up slightly to give room for bolt */}
      <Ellipse cx={24} cy={22} rx={14} ry={7} fill="#7A8BA8" />
      <Ellipse cx={16} cy={18} rx={8} ry={7} fill="#7A8BA8" />
      <Ellipse cx={30} cy={17} rx={9} ry={8} fill="#7A8BA8" />
      <Ellipse cx={23} cy={15} rx={7} ry={6.5} fill="#7A8BA8" />
      {/* Lightning bolt */}
      <Path d={boltPath} fill="#F0A050" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// SnowIcon — cloud with 3 small snowflake dots below
// ---------------------------------------------------------------------------
export function SnowIcon({ size = 48 }: { size?: number }) {
  const dots = [
    { cx: 16, cy: 40 },
    { cx: 24, cy: 40 },
    { cx: 32, cy: 40 },
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Cloud */}
      <Ellipse cx={24} cy={24} rx={14} ry={7} fill="#7A8BA8" />
      <Ellipse cx={16} cy={20} rx={8} ry={7} fill="#7A8BA8" />
      <Ellipse cx={30} cy={19} rx={9} ry={8} fill="#7A8BA8" />
      <Ellipse cx={23} cy={17} rx={7} ry={6.5} fill="#7A8BA8" />
      {/* Snow dots */}
      {dots.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r={3} fill="#F0F4F8" />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// MistIcon — three horizontal lines at varying opacity
// ---------------------------------------------------------------------------
export function MistIcon({ size = 48 }: { size?: number }) {
  const lines = [
    { y: 18, opacity: 0.4, width: 30 },
    { y: 26, opacity: 0.6, width: 36 },
    { y: 34, opacity: 0.8, width: 28 },
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {lines.map((l, i) => {
        const x1 = (48 - l.width) / 2;
        const x2 = x1 + l.width;
        return (
          <Line
            key={i}
            x1={x1}
            y1={l.y}
            x2={x2}
            y2={l.y}
            stroke="#7A8BA8"
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={l.opacity}
          />
        );
      })}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// getWeatherIcon — maps OpenWeatherMap condition codes to icon components
// ---------------------------------------------------------------------------
export function getWeatherIcon(
  conditionCode: number,
): React.ComponentType<{ size?: number }> {
  if (conditionCode >= 200 && conditionCode <= 299) return ThunderstormIcon;
  if (conditionCode >= 300 && conditionCode <= 599) return RainIcon;
  if (conditionCode >= 600 && conditionCode <= 699) return SnowIcon;
  if (conditionCode >= 700 && conditionCode <= 799) return MistIcon;
  if (conditionCode === 800) return SunIcon;
  if (conditionCode === 801) return PartlyCloudyIcon;
  return CloudIcon;
}
