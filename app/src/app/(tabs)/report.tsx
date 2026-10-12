import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Snackbar, TextInput } from 'react-native-paper';
import { Page } from '../../components/Page';
import { AppButton, Card, FadeIn, type IconName, NATIVE_DRIVER, Skeleton } from '../../components/ui';
import { cutServices } from '../../data';
import { fetchServices, submitReport } from '../../lib/api';
import { colors, fonts, radius, SCREEN_PADDING, spacing, type } from '../../theme';

type Impact = 'low' | 'medium' | 'high';
type SubmittedReport = { id: string; service: string; location: string };

const STEPS = ['Choose the service', 'What happened?', 'How much does it affect you?'];
const MAX_DESCRIPTION = 500;

const IMPACTS: { level: Impact; title: string; body: string; icon: IconName; color: string; bg: string }[] = [
  { level: 'low', title: 'Low', body: 'An inconvenience. I can manage.', icon: 'emoticon-neutral-outline', color: colors.successDark, bg: colors.successLight },
  { level: 'medium', title: 'Medium', body: 'It disrupts my week.', icon: 'emoticon-sad-outline', color: colors.warningDark, bg: colors.warningLight },
  { level: 'high', title: 'High', body: 'I depend on this service.', icon: 'alert-circle-outline', color: colors.dangerDark, bg: colors.dangerLight },
];

export default function ReportScreen() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [impactLevel, setImpactLevel] = useState<Impact>('medium');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [reports, setReports] = useState<SubmittedReport[]>([]);
  const [sent, setSent] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const check = useRef(new Animated.Value(0)).current;

  // Services for the dropdown: from the API, or the bundled list when it is unreachable.
  useEffect(() => {
    let active = true;
    fetchServices()
      .then((items) => { if (active) setOptions(items.map((s) => s.name)); })
      .catch(() => { if (active) setOptions(cutServices.map((s) => s.name)); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sent) return;
    check.setValue(0);
    Animated.spring(check, { toValue: 1, friction: 4, tension: 60, useNativeDriver: NATIVE_DRIVER }).start();
  }, [sent, check]);

  const canContinue = step === 0 ? !!service.trim() : step === 1 ? !!description.trim() : true;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function onSubmit() {
    if (!service.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await submitReport({
        service_name: service.trim(),
        location: location.trim(),
        description: description.trim(),
        impact_level: impactLevel,
        photo_uri: photoUri,
      });
      setReports((prev) => [{ id: res.id, service: service.trim(), location: location.trim() }, ...prev]);
      setSent(true);
    } catch (error) {
      setToast(error instanceof Error ? `Report not sent: ${error.message}` : 'Report not sent. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setService('');
    setLocation('');
    setDescription('');
    setImpactLevel('medium');
    setPhotoUri(null);
    setStep(0);
    setSent(false);
  }

  if (sent) {
    return (
      <Page>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.success}>
            <Animated.View style={[styles.checkCircle, { opacity: check, transform: [{ scale: check }] }]}>
              <MaterialCommunityIcons name="check" size={48} color={colors.white} />
            </Animated.View>
            <Text style={[type.h2, styles.center]}>Report sent</Text>
            <Text style={[type.bodySmall, styles.center]}>
              Thank you. Your report helps neighbors and city officials see what this change means.
            </Text>
            <AppButton variant="gold" icon="plus" label="Report another" onPress={startOver} style={styles.successButton} />
          </View>
          <Text style={type.h4}>Your reports</Text>
          {reports.map((r) => (
            <Card key={r.id} style={styles.recent}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
              <View style={styles.recentText}>
                <Text style={type.label}>{r.service}</Text>
                {!!r.location && <Text style={type.caption}>{r.location}</Text>}
              </View>
              <Text style={styles.sentTag}>Sent</Text>
            </Card>
          ))}
        </ScrollView>
      </Page>
    );
  }

  return (
    <Page>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Progress */}
          <View accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of 3: ${STEPS[step]}`}>
            <View style={styles.progress}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.segment, i <= step && styles.segmentDone]} />
              ))}
            </View>
            <Text style={styles.stepLabel}>Step {step + 1} of 3</Text>
            <Text style={type.h2}>{STEPS[step]}</Text>
          </View>

          <FadeIn key={step} style={styles.step}>
            {step === 0 && (
              <>
                <Text style={type.bodySmall}>Pick the city service that changed, or type its name.</Text>
                {loadingOptions ? (
                  <Skeleton height={56} round={radius.md} />
                ) : (
                  <View>
                    <Pressable
                      onPress={() => setDropdownOpen((open) => !open)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: dropdownOpen }}
                      accessibilityLabel={`Service: ${service || 'none chosen'}`}
                      style={[styles.dropdown, dropdownOpen && styles.dropdownOpen]}
                    >
                      <MaterialCommunityIcons name="office-building-outline" size={20} color={colors.navy} />
                      <Text numberOfLines={1} style={[styles.dropdownText, !options.includes(service) && styles.placeholder]}>
                        {options.includes(service) ? service : 'Choose a listed service'}
                      </Text>
                      <MaterialCommunityIcons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
                    </Pressable>
                    {dropdownOpen && (
                      <Card style={styles.menu}>
                        <ScrollView style={styles.menuScroll} nestedScrollEnabled>
                          {options.map((name) => {
                            const active = name === service;
                            return (
                              <Pressable
                                key={name}
                                onPress={() => { setService(name); setDropdownOpen(false); }}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                style={[styles.menuItem, active && styles.menuItemActive]}
                              >
                                <Text style={[styles.menuText, active && styles.menuTextActive]}>{name}</Text>
                                {active && <MaterialCommunityIcons name="check" size={18} color={colors.navy} />}
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </Card>
                    )}
                  </View>
                )}
                <TextInput
                  mode="outlined"
                  label="Or type the service name"
                  value={options.includes(service) ? '' : service}
                  onChangeText={setService}
                  outlineStyle={styles.outline}
                  style={styles.input}
                />
              </>
            )}

            {step === 1 && (
              <>
                <TextInput
                  mode="outlined"
                  label="Location"
                  placeholder="Address or neighborhood"
                  value={location}
                  onChangeText={setLocation}
                  outlineStyle={styles.outline}
                  style={styles.input}
                  left={<TextInput.Icon icon="map-marker-outline" />}
                />
                <View>
                  <TextInput
                    mode="outlined"
                    label="What happened? *"
                    value={description}
                    onChangeText={setDescription}
                    maxLength={MAX_DESCRIPTION}
                    multiline
                    numberOfLines={5}
                    outlineStyle={styles.outline}
                    style={[styles.input, styles.multiline]}
                  />
                  <Text style={[styles.counter, description.length >= MAX_DESCRIPTION && styles.counterFull]}>
                    {description.length}/{MAX_DESCRIPTION}
                  </Text>
                </View>
                {photoUri ? (
                  <View style={styles.photoWrap}>
                    <Image source={{ uri: photoUri }} style={styles.photo} accessibilityLabel="Attached photo" />
                    <AppButton variant="outline" icon="close" label="Remove photo" onPress={() => setPhotoUri(null)} />
                  </View>
                ) : (
                  <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Upload a photo" style={styles.upload}>
                    <MaterialCommunityIcons name="camera-plus-outline" size={24} color={colors.navy} />
                    <Text style={type.label}>Upload a photo</Text>
                    <Text style={type.caption}>Optional</Text>
                  </Pressable>
                )}
              </>
            )}

            {step === 2 && (
              <View style={styles.impacts} accessibilityRole="radiogroup">
                {IMPACTS.map((impact) => {
                  const active = impactLevel === impact.level;
                  return (
                    <Pressable
                      key={impact.level}
                      onPress={() => setImpactLevel(impact.level)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${impact.title} impact. ${impact.body}`}
                      style={[styles.impact, active && { borderColor: impact.color, backgroundColor: impact.bg }]}
                    >
                      <View style={[styles.impactIcon, { backgroundColor: active ? colors.surface : impact.bg }]}>
                        <MaterialCommunityIcons name={impact.icon} size={28} color={impact.color} />
                      </View>
                      <View style={styles.impactText}>
                        <Text style={type.h4}>{impact.title}</Text>
                        <Text style={type.bodySmall}>{impact.body}</Text>
                      </View>
                      <MaterialCommunityIcons
                        name={active ? 'radiobox-marked' : 'radiobox-blank'}
                        size={24}
                        color={active ? impact.color : colors.border}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </FadeIn>

          <View style={styles.nav}>
            {step > 0 && <AppButton variant="outline" icon="arrow-left" label="Back" onPress={() => setStep(step - 1)} style={styles.navButton} />}
            {step < 2 ? (
              <AppButton label="Continue" disabled={!canContinue} onPress={() => { setDropdownOpen(false); setStep(step + 1); }} style={styles.navButton} />
            ) : (
              <AppButton variant="gold" icon="send" label="Submit report" loading={submitting} onPress={onSubmit} style={styles.navButton} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Snackbar visible={!!toast} onDismiss={() => setToast('')} duration={5000}>
        {toast}
      </Snackbar>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SCREEN_PADDING, gap: spacing.xl, paddingBottom: spacing.huge },
  progress: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.gold },
  stepLabel: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.goldDark, marginBottom: spacing.xs },
  step: { gap: spacing.lg },
  dropdown: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dropdownOpen: { borderColor: colors.navy },
  dropdownText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  placeholder: { color: colors.muted },
  menu: { marginTop: spacing.sm, padding: spacing.sm },
  menuScroll: { maxHeight: 260 },
  menuItem: { minHeight: 48, borderRadius: radius.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  menuItemActive: { backgroundColor: colors.navyLight },
  menuText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  menuTextActive: { fontFamily: fonts.semibold, color: colors.navy },
  input: { backgroundColor: colors.surface },
  outline: { borderRadius: radius.md },
  multiline: { minHeight: 140 },
  counter: { ...type.caption, textAlign: 'right', marginTop: spacing.xs },
  counterFull: { color: colors.dangerDark },
  upload: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  photoWrap: { gap: spacing.md },
  photo: { width: '100%', height: 200, borderRadius: radius.md },
  impacts: { gap: spacing.md },
  impact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 88,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  impactIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  impactText: { flex: 1, gap: 2 },
  nav: { flexDirection: 'row', gap: spacing.md },
  navButton: { flex: 1 },
  success: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  checkCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  center: { textAlign: 'center', maxWidth: 320 },
  successButton: { alignSelf: 'stretch', marginTop: spacing.md },
  recent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  recentText: { flex: 1, gap: 2 },
  sentTag: { fontFamily: fonts.semibold, fontSize: 12, color: colors.successDark },
});
