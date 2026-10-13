import * as Location from 'expo-location';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { FREMONT_CENTER } from '../data';
import { useTranslation } from '../lib/i18n';
import { type AppLocation, locationStore, lookupZip } from '../state/stores';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { inFremont } from '../utils/geo';
import { Sheet } from './Sheet';
import { Icon, AppButton, AppText, Banner, Field } from './ui';

const GPS_TIMEOUT_MS = 12000;
const LOW_ACCURACY_METERS = 1000;

export type GpsOutcome =
  | { status: 'ok'; location: AppLocation; outside: boolean }
  | { status: 'denied' | 'blocked' | 'unavailable' | 'timeout' };

/**
 * Asks for the device location once, after the person has tapped "Use my location".
 * Every way this can fail has its own outcome so the screen can say what happened.
 */
export async function requestGps(): Promise<GpsOutcome> {
  try {
    if (Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) return { status: 'unavailable' };
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) return { status: 'blocked' };
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return { status: permission.canAskAgain ? 'denied' : 'blocked' };
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GPS_TIMEOUT_MS)),
    ]);
    if (!position) return { status: 'timeout' };
    // Three decimal places (about 100 meters) is plenty for "what is near me" and keeps less.
    const lat = Math.round(position.coords.latitude * 1000) / 1000;
    const lng = Math.round(position.coords.longitude * 1000) / 1000;
    const outside = !inFremont({ latitude: lat, longitude: lng });
    return {
      status: 'ok',
      outside,
      location: { kind: 'gps', label: '', lat, lng, lowAccuracy: (position.coords.accuracy ?? 0) > LOW_ACCURACY_METERS },
    };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    // Browsers report a refusal as code 1 and "position unavailable" as code 2.
    if (code === 1 || code === 'E_LOCATION_UNAUTHORIZED') return { status: 'denied' };
    return { status: 'unavailable' };
  }
}

/** Dialog for choosing where "near me" is: device location, a Fremont ZIP code, or City Hall. */
export function LocationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const location = locationStore.use();
  const [zip, setZip] = useState('');
  const [zipError, setZipError] = useState<string | null>(null);
  const [outsideZip, setOutsideZip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warning' | 'success'; text: string } | null>(null);

  function finish(next: AppLocation | null) {
    locationStore.set(next);
    setZip('');
    setZipError(null);
    setOutsideZip(false);
    setNotice(null);
    onClose();
  }

  async function useGps() {
    setBusy(true);
    setNotice(null);
    const outcome = await requestGps();
    setBusy(false);
    if (outcome.status !== 'ok') {
      setNotice({ tone: 'warning', text: t(`location.gps.${outcome.status}`) });
      return;
    }
    // No neighborhood name: the nearest ZIP center is often the wrong ZIP (City Hall is closer to
    // the 94536 center than to its own), and the app has no ZIP boundaries to check against.
    const label = t(outcome.outside ? 'location.outsideLabel' : 'location.gpsLabel');
    locationStore.set({ ...outcome.location, label });
    if (outcome.outside) setNotice({ tone: 'info', text: t('location.gps.outside') });
    else if (outcome.location.lowAccuracy) setNotice({ tone: 'info', text: t('location.gps.lowAccuracy') });
    else finish({ ...outcome.location, label });
  }

  function useZip() {
    const result = lookupZip(zip);
    if (result.ok) return finish(result.location);
    setOutsideZip(result.reason === 'outside');
    setZipError(t(result.reason === 'format' ? 'location.zipFormat' : 'location.zipOutside'));
  }

  const useCenter = () => finish(null);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('location.title')} testID="location-sheet">
      <AppText variant="bodySmall" color={colors.text}>{t('location.explain')}</AppText>
      {notice && <Banner tone={notice.tone} body={notice.text} live testID="location-notice" />}

      <View style={styles.block}>
        <AppText variant="h4" heading={3}>{t('location.gpsHeading')}</AppText>
        <AppText variant="caption">{t('location.gpsExplain')}</AppText>
        <AppButton variant="navy" icon="crosshairs-gps" label={t(busy ? 'location.locating' : 'common.useMyLocation')} loading={busy} onPress={useGps} testID="use-gps" />
      </View>

      <View style={styles.block}>
        <AppText variant="h4" heading={3}>{t('location.zipHeading')}</AppText>
        <Field
          label={t('location.zipLabel')}
          hint={t('location.zipHint')}
          value={zip}
          onChangeText={(text) => { setZip(text); setZipError(null); setOutsideZip(false); }}
          error={zipError}
          keyboardType="number-pad"
          autoComplete="postal-code"
          maxLength={10}
          onSubmitEditing={useZip}
          testID="zip-input"
        />
        <AppButton variant="outline" icon="map-marker-check" label={t('location.useZip')} onPress={useZip} testID="use-zip" />
        {outsideZip && <AppButton variant="gold" icon="city" label={t('location.useCenter')} onPress={useCenter} testID="use-center-offer" />}
      </View>

      <View style={styles.block}>
        <AppButton variant="outline" icon="city" label={t('location.useCenter')} onPress={useCenter} testID="use-center" />
        {location && <AppButton variant="danger" icon="map-marker-off" label={t('location.clear')} onPress={useCenter} testID="clear-location" />}
        <AppText variant="caption">{t('location.privacy')}</AppText>
      </View>
    </Sheet>
  );
}

/** "Showing results near: ___ [Change]". The one control for location on every screen that uses it. */
export function LocationChip({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const location = locationStore.use();
  const [open, setOpen] = useState(false);
  const label = location ? location.label : t('location.centerLabel');
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('location.showingNear', { place: label })}. ${t('location.change')}`}
        testID="location-chip"
        style={({ pressed }) => [styles.chip, compact && styles.chipCompact, pressed && styles.pressed]}
      >
        <Icon name={location?.kind === 'gps' ? 'crosshairs-gps' : 'map-marker'} size={18} color={colors.navy} />
        <AppText variant="bodySmall" color={colors.text} style={styles.chipText} numberOfLines={2} testID="location-label">
          {t('location.showingNear', { place: label })}
        </AppText>
        <AppText variant="label" color={colors.navy} style={styles.change}>{t('location.change')}</AppText>
      </Pressable>
      <LocationSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export { FREMONT_CENTER };

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.navyLight },
  chipCompact: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong },
  chipText: { flex: 1 },
  change: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.8 },
  block: { gap: spacing.sm },
});
