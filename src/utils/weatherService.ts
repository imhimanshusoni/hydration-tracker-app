// Weather service: fetches current weather via device location + OpenWeatherMap.
// Falls back to manual climate preference if location or API fails.

import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { OPENWEATHERMAP_API_KEY } from '../config';
import { getWeatherBonusFromTemp } from './waterCalculator';

export { getWeatherBonusFromTemp as getWeatherBonus };

export async function requestLocationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted';
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function getCurrentPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000,
      },
    );
  });
}

export async function fetchCurrentWeather(): Promise<{
  tempC: number;
  humidity: number;
} | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const coords = await getCurrentPosition();
    if (!coords) return null;

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&units=metric&appid=${OPENWEATHERMAP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      tempC: data.main.temp,
      humidity: data.main.humidity,
    };
  } catch {
    return null;
  }
}
