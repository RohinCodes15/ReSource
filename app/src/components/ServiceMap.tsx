import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors, statusTone } from '../theme';
import { FREMONT_CENTER } from '../utils/geo';
import type { ServiceMapProps } from './ServiceMap.types';

/** Native (iOS/Android) map. The web build uses ServiceMap.web.tsx instead. */
export default function ServiceMap({ services, selectedId, onSelect }: ServiceMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const selected = services.find((s) => s.id === selectedId);
    if (selected) {
      // Centre a little south of the pin so the bottom sheet does not cover it.
      mapRef.current?.animateToRegion(
        { latitude: selected.latitude - 0.008, longitude: selected.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        400,
      );
    }
  }, [selectedId, services]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{ ...FREMONT_CENTER, latitudeDelta: 0.14, longitudeDelta: 0.14 }}
      accessibilityLabel="Map of Fremont showing city services and their status"
    >
      {services.map((s) => {
        const selected = s.id === selectedId;
        return (
          <Marker
            // The key changes with selection so the custom pin redraws.
            key={`${s.id}-${selected}`}
            coordinate={{ latitude: s.latitude, longitude: s.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            accessibilityLabel={`${s.name}, ${statusTone(s.status).label}`}
            onPress={() => onSelect(s.id)}
          >
            {/* White circle with a status-colored dot: green open, amber reduced, red closed. */}
            <View style={[styles.pin, selected && styles.pinSelected]}>
              <View style={[styles.dot, selected && styles.dotSelected, { backgroundColor: statusTone(s.status).color }]} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pinSelected: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: colors.navy },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotSelected: { width: 18, height: 18, borderRadius: 9 },
});
