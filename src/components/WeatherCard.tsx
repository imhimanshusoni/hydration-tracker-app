// WeatherCard — horizontal weather info card with adaptive SVG gradient background.
// Reads weatherData from useGoalStore. Returns null when no data is available.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import type { AppTheme } from '../theme';
import { Fonts } from '../fonts';
import { useGoalStore } from '../store/useGoalStore';
import { getWeatherIcon } from './WeatherIcons';

interface WeatherCardProps {
  theme: AppTheme;
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getGradientColors(conditionMain: string, tempC: number): { left: string; right: string } {
  switch (conditionMain) {
    case 'Clear':
      return tempC > 30
        ? { left: '#2D1810', right: '#1A1020' }
        : { left: '#0D1B2A', right: '#132840' };
    case 'Clouds':
      return { left: '#141E2E', right: '#1A2838' };
    case 'Rain':
    case 'Drizzle':
      return { left: '#0A1628', right: '#0D2040' };
    case 'Thunderstorm':
      return { left: '#150D20', right: '#1A1030' };
    case 'Snow':
      return { left: '#1A2030', right: '#202838' };
    case 'Mist':
    case 'Fog':
    case 'Haze':
    case 'Smoke':
    case 'Dust':
    case 'Sand':
    case 'Ash':
    case 'Squall':
    case 'Tornado':
      return { left: '#141820', right: '#1A2028' };
    default:
      return { left: '#0D1B2A', right: '#132840' };
  }
}

export function WeatherCard({ theme }: WeatherCardProps) {
  const weatherData = useGoalStore((s) => s.weatherData);

  if (!weatherData) {
    return null;
  }

  const { tempC, feelsLikeC, humidity, conditionCode, conditionMain, description, cityName } = weatherData;
  const { left, right } = getGradientColors(conditionMain, tempC);

  const WeatherIcon = getWeatherIcon(conditionCode);

  return (
    <View style={styles.card}>
      {/* Adaptive gradient background */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="weatherGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={left} stopOpacity="1" />
            <Stop offset="1" stopColor={right} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#weatherGrad)" />
      </Svg>

      {/* Icon */}
      <WeatherIcon size={48} />

      {/* Center: condition + location */}
      <View style={styles.centerColumn}>
        <Text style={[styles.conditionText, { color: theme.text }]}>
          {toTitleCase(description)}
        </Text>
        <Text style={[styles.feelsLikeText, { color: theme.textSecondary }]}>
          {cityName
            ? `${cityName} · Feels like ${Math.round(feelsLikeC)}°C`
            : `Feels like ${Math.round(feelsLikeC)}°C`}
        </Text>
      </View>

      {/* Right: temperature + humidity */}
      <View style={styles.rightColumn}>
        <Text style={[styles.tempText, { color: theme.text }]}>
          {Math.round(tempC)}°C
        </Text>
        <Text style={[styles.humidityText, { color: theme.textSecondary }]}>
          {humidity}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  centerColumn: {
    flex: 1,
  },
  conditionText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  feelsLikeText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  tempText: {
    fontSize: 22,
    fontFamily: Fonts.bold,
  },
  humidityText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
});
