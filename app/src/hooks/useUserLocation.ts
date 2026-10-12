import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { LatLng } from '../utils/geo';

type Status = 'idle' | 'loading' | 'granted' | 'denied' | 'error';

export function useUserLocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const request = useCallback(async () => {
    setStatus('loading');
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setStatus('granted');
    } catch {
      setStatus('error');
    }
  }, []);

  return { location, status, request };
}
