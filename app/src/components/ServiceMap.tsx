import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors, statusTone } from '../theme';
import type { ServiceMapProps } from './ServiceMap.types';

const CITY_DELTA = 0.14;

/** Phone map (iOS and Android). The web build uses ServiceMap.web.tsx instead. */
export default function ServiceMap({ pins, selectedId, onSelect, center, you, recenterKey, labels }: ServiceMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const pin = pins.find((p) => p.service.id === selectedId);
    if (pin) {
      // Center a little below the pin so the detail sheet does not cover it.
      mapRef.current?.animateToRegion({ latitude: pin.latitude - 0.006, longitude: pin.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 300);
    }
    // Only when the selection changes, not when the filter does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    mapRef.current?.animateToRegion({ ...center, latitudeDelta: CITY_DELTA, longitudeDelta: CITY_DELTA }, 300);
  }, [recenterKey, center]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{ ...center, latitudeDelta: CITY_DELTA, longitudeDelta: CITY_DELTA }}
      accessibilityLabel={labels.map}
      testID="service-map"
    >
      {you && (
        <Marker coordinate={you} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel={labels.you}>
          <View style={styles.you} />
        </Marker>
      )}
      {pins.map((pin) => {
        const selected = pin.service.id === selectedId;
        const tone = statusTone(pin.service.status);
        const size = selected ? 40 : 32;
        return (
          <Marker
            // The key changes with selection so the custom pin redraws.
            key={`${pin.service.id}-${selected}`}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            anchor={{ x: 0.5 - pin.dx / size, y: 0.5 - pin.dy / size }}
            tracksViewChanges={false}
            accessibilityLabel={pin.label}
            onPress={() => onSelect(pin.service.id)}
          >
            {/* A glyph inside the pin carries the status, so it does not depend on color. */}
            <View style={[styles.pin, { backgroundColor: tone.bg }, selected && styles.pinSelected]}>
              <Text style={[styles.glyph, { color: tone.text }, selected && styles.glyphSelected]}>{tone.glyph}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  pinSelected: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.navyDark },
  glyph: { fontSize: 16, fontWeight: '700' },
  glyphSelected: { fontSize: 20 },
  you: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.navy, borderWidth: 3, borderColor: colors.white },
});
