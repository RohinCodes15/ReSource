import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AREA_CODES } from '../../../../shared/constants';
import type { AreaCode, ImpactLevel } from '../../../../shared/types';
import { BrowseOnly, ConsentFields, useConsent } from '../../components/ConsentFields';
import { Screen } from '../../components/Page';
import { Icon, a11yState, AppButton, AppText, Banner, Card, Chip, Field, type IconName, Pill } from '../../components/ui';
import { bundledServices } from '../../data';
import { useApi } from '../../hooks/useData';
import { ApiError, createReport, getMyReports, getServices, type ReportReceipt, uploadReportPhoto } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { ageStore, locationStore } from '../../state/stores';
import { colors, MIN_TOUCH, radius, spacing } from '../../theme';

const OTHER = 'other';
const MAX_DESCRIPTION = 1000;
const MIN_DESCRIPTION = 10;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMPACTS: { level: ImpactLevel; icon: IconName }[] = [
  { level: 'low', icon: 'emoticon-neutral-outline' },
  { level: 'medium', icon: 'emoticon-sad-outline' },
  { level: 'high', icon: 'alert-circle-outline' },
];
type Photo = { uri: string; mimeType?: string | null };

/** Report an Impact: three short steps, then a receipt. Reports wait for review before they count. */
export default function ReportScreen() {
  const { t, tx, locale, dirIcon } = useTranslation();
  const params = useLocalSearchParams<{ service?: string }>();
  const age = ageStore.use();
  const services = useApi(getServices, () => bundledServices);
  const mine = useApi(getMyReports);
  const consent = useConsent();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('');
  const [area, setArea] = useState<AreaCode>(locationStore.get()?.area ?? 'citywide');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState<ImpactLevel | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Arriving from a service's "Report an impact" button pre-selects that service.
  const [seenParam, setSeenParam] = useState<string | undefined>(undefined);
  if (params.service !== seenParam) {
    setSeenParam(params.service);
    if (params.service) { setServiceId(params.service); setStep(0); }
  }

  // A link with an id that is not on the list selects nothing, so the person picks one.
  if (serviceId && serviceId !== OTHER && services.data && !services.data.some((s) => s.id === serviceId)) setServiceId(null);

  const steps = [t('report.step1'), t('report.step2'), t('report.step3')];
  const serviceError = !serviceId ? t('report.serviceRequired') : serviceId === OTHER && otherName.trim().length < 2 ? t('report.serviceNameRequired') : null;
  const descriptionError = description.trim().length < MIN_DESCRIPTION ? t('report.descriptionTooShort', { min: MIN_DESCRIPTION }) : null;
  const impactError = impact ? null : t('report.impactRequired');
  const stepError = [serviceError, descriptionError, impactError][step];

  function next() {
    setTouched(true);
    if (stepError) return;
    setTouched(false);
    setStep(step + 1);
  }

  async function pickPhoto() {
    setPhotoError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.mimeType && !PHOTO_TYPES.includes(asset.mimeType)) return setPhotoError(t('report.photoType'));
    // Browsers do not always fill in fileSize; the picked File knows its own size.
    const bytes = asset.fileSize ?? asset.file?.size;
    if (bytes && bytes > MAX_PHOTO_BYTES) return setPhotoError(t('report.photoTooLarge'));
    setPhoto({ uri: asset.uri, mimeType: asset.mimeType });
  }

  async function sendPhoto(reportId: string, picked: Photo) {
    try {
      await uploadReportPhoto(reportId, picked);
      setPhotoFailed(false);
    } catch {
      setPhotoFailed(true);
    }
  }

  async function submit() {
    setTouched(true);
    const agreed = consent.check();
    if (impactError || !agreed || submitting) return; // `submitting` also blocks a double tap
    setSubmitting(true);
    setFailure(null);
    try {
      const chosen = services.data?.find((s) => s.id === serviceId);
      const created = await createReport({
        service_id: chosen ? chosen.id : null,
        service_name: chosen ? chosen.name : otherName.trim(),
        area,
        description: description.trim(),
        impact_level: impact as ImpactLevel,
        ...consent.flags(),
      });
      if (photo) await sendPhoto(created.id, photo);
      setReceipt(created);
      mine.reload();
    } catch (reason) {
      const error = reason instanceof ApiError ? reason : new ApiError(0, 'network');
      setFailure(t(error.isNetwork ? 'report.failedOffline' : error.status === 429 ? 'errors.rateLimited' : error.code === 'spam_detected' ? 'errors.generic' : 'report.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setStep(0); setServiceId(null); setOtherName(''); setDescription(''); setImpact(null); setPhoto(null);
    setTouched(false); setReceipt(null); setFailure(null); setPhotoFailed(false); consent.reset();
  }

  const myReports = (mine.data ?? []).length > 0 && (
    <View style={styles.block} testID="my-reports">
      <AppText variant="h3" heading={2}>{t('report.yours')}</AppText>
      {(mine.data ?? []).map((r) => (
        <Card key={r.id} style={styles.mine}>
          <AppText variant="label">{r.service_name}</AppText>
          <AppText variant="caption">{formatDate(r.created_at, locale)} · {tx('area', r.area)} · {tx('impact', r.impact_level)}</AppText>
          <Pill label={tx('reportStatus', r.status)} icon={r.status === 'verified' ? 'check-circle' : r.status === 'rejected' ? 'close-circle' : 'clock-outline'} color={colors.navy} bg={colors.navyLight} />
        </Card>
      ))}
    </View>
  );
  // Use the bundled choices while the API request is in flight. Sort both copies the same way so
  // arriving live data does not reorder the long list and move the footer on first load.
  const availableServices = useMemo(
    () => [...(services.data ?? bundledServices)].sort((a, b) => a.name.localeCompare(b.name)),
    [services.data],
  );

  if (age === 'under13') return <Screen title={t('titles.report')}><BrowseOnly /></Screen>;

  if (receipt) {
    return (
      <Screen title={t('titles.report')} testID="report-success">
        <View style={styles.success}>
          <View style={styles.check}><Icon name="check" size={44} color={colors.white} /></View>
          <AppText variant="h2" heading={2} center live="polite">{t('report.sentTitle')}</AppText>
          <AppText center color={colors.text}>{t('report.sentBody')}</AppText>
          <AppText variant="caption" center testID="report-receipt">{t('report.receipt', { id: receipt.id.slice(0, 8) })}</AppText>
        </View>
        {!!receipt.pii_removed?.length && <Banner tone="info" body={t('report.piiRemoved')} />}
        {photoFailed && photo && (
          <Banner tone="warning" body={t('report.photoFailed')} live>
            <AppButton variant="outline" small icon="refresh" label={t('common.retry')} onPress={() => sendPhoto(receipt.id, photo)} testID="photo-retry" />
          </Banner>
        )}
        <AppButton variant="gold" icon="plus" label={t('report.another')} onPress={startOver} testID="report-another" />
        {myReports}
      </Screen>
    );
  }

  return (
    <Screen title={t('titles.report')} testID="report-screen">
      <View accessible role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} accessibilityLabel={t('report.progress', { step: step + 1, total: 3, name: steps[step] })}>
        <View style={styles.progress}>
          {steps.map((_, i) => <View key={i} style={[styles.segment, i <= step && styles.segmentDone]} />)}
        </View>
        <AppText variant="caption" color={colors.text}>{t('report.stepOf', { step: step + 1, total: 3 })}</AppText>
      </View>
      <AppText variant="h2" heading={2} testID="report-step-title">{steps[step]}</AppText>

      {step === 0 && (
        <View style={styles.block}>
          <AppText variant="bodySmall" color={colors.text}>{t('report.step1Help')}</AppText>
          <View role="radiogroup" accessibilityLabel={steps[0]} style={styles.options}>
            {[...availableServices.map((s) => ({ id: s.id, name: s.name })), { id: OTHER, name: t('report.other') }].map((option) => {
              const active = serviceId === option.id;
              return (
                <Pressable key={option.id} onPress={() => setServiceId(option.id)} role="radio" aria-checked={active} accessibilityState={a11yState({ selected: active })} accessibilityLabel={option.name} testID={`service-option-${option.id}`} style={({ pressed }) => [styles.option, active && styles.optionOn, pressed && styles.optionPressed]}>
                  <Icon name={active ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={active ? colors.navy : colors.borderStrong} />
                  <AppText style={styles.flex}>{option.name}</AppText>
                </Pressable>
              );
            })}
          </View>
          {serviceId === OTHER && <Field label={t('report.otherLabel')} value={otherName} onChangeText={setOtherName} maxLength={160} required error={touched ? serviceError : null} testID="other-service" />}
          {touched && serviceError && serviceId !== OTHER && <AppText variant="caption" color={colors.dangerDark} live="polite" testID="step-error">{serviceError}</AppText>}
        </View>
      )}

      {step === 1 && (
        <View style={styles.block}>
          <AppText variant="label">{t('report.areaLabel')}</AppText>
          <View style={styles.chips} role="radiogroup" accessibilityLabel={t('report.areaLabel')}>
            {AREA_CODES.map((code) => <Chip key={code} role="radio" label={tx('area', code)} selected={area === code} onPress={() => setArea(code)} testID={`report-area-${code}`} />)}
          </View>
          <Field label={t('report.descriptionLabel')} hint={t('report.descriptionHint')} value={description} onChangeText={setDescription} multiline maxLength={MAX_DESCRIPTION} required error={touched ? descriptionError : null} testID="report-description" />
          {photo ? (
            <View style={styles.block}>
              <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel={t('report.photoAlt')} />
              <AppButton variant="outline" icon="close" label={t('report.removePhoto')} onPress={() => setPhoto(null)} testID="remove-photo" />
            </View>
          ) : (
            <AppButton variant="outline" icon="camera-plus-outline" label={t('report.addPhoto')} onPress={pickPhoto} testID="add-photo" />
          )}
          <AppText variant="caption">{t('report.photoHelp')}</AppText>
          {!!photoError && <AppText variant="caption" color={colors.dangerDark} live="polite">{photoError}</AppText>}
        </View>
      )}

      {step === 2 && (
        <View style={styles.block}>
          <View role="radiogroup" accessibilityLabel={steps[2]} style={styles.options}>
            {IMPACTS.map(({ level, icon }) => {
              const active = impact === level;
              return (
                <Pressable key={level} onPress={() => setImpact(level)} role="radio" aria-checked={active} accessibilityState={a11yState({ selected: active })} accessibilityLabel={`${tx('impact', level)}. ${t(`report.impact_${level}`)}`} testID={`impact-${level}`} style={({ pressed }) => [styles.option, active && styles.optionOn, pressed && styles.optionPressed]}>
                  <Icon name={active ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={active ? colors.navy : colors.borderStrong} />
                  <Icon name={icon} size={26} color={colors.navy} />
                  <View style={styles.flex}>
                    <AppText variant="h4">{tx('impact', level)}</AppText>
                    <AppText variant="bodySmall">{t(`report.impact_${level}`)}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {touched && impactError && <AppText variant="caption" color={colors.dangerDark} live="polite" testID="step-error">{impactError}</AppText>}
          <ConsentFields purpose={t('report.consent')} consent={consent} />
          {!!failure && (
            <Banner tone="danger" body={failure} live testID="report-failure">
              <AppButton variant="outline" small icon="refresh" label={t('common.retry')} onPress={submit} testID="report-retry" />
            </Banner>
          )}
        </View>
      )}

      <View style={styles.nav}>
        {step > 0 && <AppButton variant="outline" icon={dirIcon('arrow-left')} label={t('common.back')} onPress={() => { setTouched(false); setStep(step - 1); }} style={styles.navButton} testID="report-back" />}
        {step < 2
          ? <AppButton label={t('common.next')} onPress={next} style={styles.navButton} testID="report-next" />
          : <AppButton variant="gold" icon="send" label={t('report.submit')} loading={submitting} onPress={submit} style={styles.navButton} testID="report-submit" />}
      </View>
      {myReports}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: spacing.md },
  progress: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.navy },
  options: { gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH + 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  optionOn: { borderColor: colors.navy, borderWidth: 2, backgroundColor: colors.navyLight },
  optionPressed: { opacity: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: '100%', height: 200, borderRadius: radius.md },
  nav: { flexDirection: 'row', gap: spacing.md },
  navButton: { flex: 1 },
  success: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  check: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.successDark, alignItems: 'center', justifyContent: 'center' },
  mine: { gap: spacing.xs },
});
