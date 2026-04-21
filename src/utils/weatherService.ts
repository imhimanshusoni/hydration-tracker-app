// Weather service: fetches current weather via device location + OpenWeatherMap.
// Falls back to manual climate preference if location or API fails.

import { PermissionsAndroid, Platform } from 'react-native';

import Geolocation from 'react-native-geolocation-service';
import { OPENWEATHERMAP_API_KEY } from '../config';
import { getWeatherBonusFromTemp } from './waterCalculator';
import { track } from '../services/analytics';

export { getWeatherBonusFromTemp as getWeatherBonus };

export async function requestLocationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted';
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function getCurrentPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        console.log('[Weather] geolocation error:', error.code, error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 600000,
        forceLocationManager: true,
        showLocationDialog: true,
      },
    );
  });
}

export async function fetchCurrentWeather(): Promise<{
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  conditionCode: number;
  conditionMain: string;
  description: string;
  cityName: string | null;
} | null> {
  try {
    const hasPermission = await requestLocationPermission();
    console.log('[Weather] permission:', hasPermission);
    if (!hasPermission) {
      track('Weather Fetch Failed', { error_code: 'location_denied', fallback_used: 'climate' });
      return null;
    }

    const coords = await getCurrentPosition();
    console.log('[Weather] coords:', coords);
    if (!coords) {
      track('Weather Fetch Failed', { error_code: 'no_location', fallback_used: 'climate' });
      return null;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${OPENWEATHERMAP_API_KEY}`;
    const response = await fetch(url);
    console.log('[Weather] API status:', response.status);
    if (!response.ok) {
      track('Weather Fetch Failed', { error_code: `http_${response.status}`, fallback_used: 'climate' });
      return null;
    }

    const data = await response.json();
    console.log('[Weather] success:', data.weather[0].main, data.main.temp);

    return {
      tempC: data.main.temp,
      feelsLikeC: data.main.feels_like,
      humidity: data.main.humidity,
      conditionCode: data.weather[0].id,
      conditionMain: data.weather[0].main,
      description: data.weather[0].description,
      cityName: data.name ?? null,
    };
  } catch (e) {
    console.log('[Weather] error:', e);
    track('Weather Fetch Failed', { error_code: 'exception', fallback_used: 'climate' });
    return null;
  }
}
