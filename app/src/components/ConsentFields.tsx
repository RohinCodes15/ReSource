import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { ageStore } from '../state/stores';
import { colors, spacing } from '../theme';
import { AppButton, AppText, Banner, Checkbox, LinkText } from './ui';

export type ConsentState = { consent: boolean; age: boolean; website: string };

/** Both boxes start unticked every time a form opens. A choice is never remembered or pre-filled. */
export function useConsent() {
  const [state, setState] = useState<ConsentState>({ consent: false, age: false, website: '' });
  const [showErrors, setShowErrors] = useState(false);
  return {
    state,
    setState,
    showErrors,
    valid: state.consent && state.age,
    /** Call on submit: returns true when both boxes are ticked, otherwise reveals the errors. */
    check() {
      const ok = state.consent && state.age;
      setShowErrors(!ok);
      return ok;
    },
    reset() {
      setState({ consent: false, age: false, website: '' });
      setShowErrors(false);
    },
    /** The three fields every consenting request body carries. */
    flags: () => ({ consent: state.consent, age_confirmed: state.age, website: state.website }),
  };
}

/**
 * Shown in place of any form that sends data when someone has said they are under 13.
 * They can keep using everything that only reads information.
 */
export function BrowseOnly() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Banner tone="info" title={t('consent.browseOnlyTitle')} body={t('consent.browseOnlyBody')} testID="browse-only">
      <LinkText label={t('consent.parentLink')} onPress={() => router.push('/data-request' as never)} />
    </Banner>
  );
}

/**
 * The consent block for every form that stores what a person writes: a plain-language purpose,
 * a separate age confirmation, a link to the Privacy Policy, and a reminder not to include
 * personal details. Submission is blocked until both boxes are ticked.
 */
export function ConsentFields({ purpose, consent }: { purpose: string; consent: ReturnType<typeof useConsent> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { state, setState, showErrors } = consent;
  return (
    <View style={styles.wrap} testID="consent-fields">
      <AppText variant="caption">{t('consent.noPersonalDetails')}</AppText>
      <Checkbox
        checked={state.consent}
        onChange={(next) => setState({ ...state, consent: next })}
        label={purpose}
        error={showErrors && !state.consent ? t('consent.consentRequired') : null}
        testID="consent-checkbox"
      />
      <LinkText label={t('consent.readPrivacy')} onPress={() => router.push('/privacy' as never)} testID="consent-privacy-link" />
      <Checkbox
        checked={state.age}
        onChange={(next) => setState({ ...state, age: next })}
        label={t('consent.ageConfirm')}
        error={showErrors && !state.age ? t('consent.ageRequired') : null}
        testID="age-checkbox"
      />
      <AppButton variant="outline" small label={t('consent.under13')} onPress={() => ageStore.set('under13')} testID="under-13" />
      {/* Honeypot: people never see or reach this field, so anything typed in it came from a bot. */}
      {Platform.OS === 'web' && (
        <View style={styles.trap} aria-hidden>
          <TextInput
            value={state.website}
            onChangeText={(website) => setState({ ...state, website })}
            tabIndex={-1}
            autoComplete="off"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="honeypot"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  trap: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, left: -9999 },
});
