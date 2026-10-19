import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors } from '../theme';
import type { ServiceMapProps } from './ServiceMap.types';

const CITY_DELTA = 0.14;

/** Phone map (iOS and Android). The web build uses ServiceMap.web.tsx instead. */
export default function ServiceMap({ pins, selectedId, onSelect, center, you, recenterKey, labels }: ServiceMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const pin = pins.find((p) => p.id === selectedId);
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
        const selected = pin.id === selectedId;
        const resource = pin.kind === 'resource';
        const size = selected ? 40 : 32;
        return (
          <Marker
            // The key changes with selection so the custom pin redraws.
            key={`${pin.id}-${selected}`}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            anchor={{ x: 0.5 - pin.dx / size, y: 0.5 - pin.dy / size }}
            tracksViewChanges={false}
            accessibilityLabel={pin.label}
            onPress={() => onSelect(pin.id)}
          >
            {/* Shape and glyph carry the meaning (status disc, or "+" square for a place to get help), not color alone. */}
            <View style={[styles.pin, { backgroundColor: pin.bg }, selected && styles.pinSelected, resource && styles.square, resource && selected && styles.squareSelected]}>
              <Text style={[styles.glyph, { color: pin.fg }, selected && styles.glyphSelected]}>{pin.glyph}</Text>
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
  square: { borderRadius: 8 },
  squareSelected: { borderColor: colors.gold },
  glyph: { fontSize: 16, fontWeight: '700' },
  glyphSelected: { fontSize: 20 },
  you: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.navy, borderWidth: 3, borderColor: colors.white },
});
