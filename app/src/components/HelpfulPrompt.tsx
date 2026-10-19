import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError, sendHelpfulRating } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { ageStore } from '../state/stores';
import { spacing } from '../theme';
import { AppButton, AppText } from './ui';

// Answers given this session, so a list that unmounts and remounts a row does not ask again.
const answered = new Set<string>();

/**
 * "Was this helpful?" with Yes and No. Only the answer and `context` (which screen it is on,
 * e.g. "for_me") are sent, as feedback with nothing that identifies the person. Hidden in
 * browse-only mode, like every other form that sends something.
 */
export function HelpfulPrompt({ context, id, testID = `helpful-${context}` }: { context: string; id?: string; testID?: string }) {
  const { t } = useTranslation();
  const age = ageStore.use();
  const key = `${context}:${id ?? ''}`;
  const [state, setState] = useState<'ask' | 'sending' | 'thanks'>(answered.has(key) ? 'thanks' : 'ask');
  const [error, setError] = useState<string | null>(null);
  if (age === 'under13') return null;

  async function answer(wasHelpful: boolean) {
    setState('sending');
    setError(null);
    try {
      await sendHelpfulRating(context, wasHelpful);
      answered.add(key);
      setState('thanks');
    } catch (reason) {
      setState('ask');
      setError(t(reason instanceof ApiError && reason.status === 429 ? 'errors.rateLimited' : 'helpful.failed'));
    }
  }

  if (state === 'thanks') return <AppText variant="caption" live="polite" testID={`${testID}-thanks`}>{t('helpful.thanks')}</AppText>;
  return (
    <View style={styles.block} testID={testID}>
      <View style={styles.row} role="group" accessibilityLabel={t('helpful.question')}>
        <AppText variant="label">{t('helpful.question')}</AppText>
        <AppButton variant="outline" small label={t('helpful.yes')} disabled={state === 'sending'} onPress={() => answer(true)} testID={`${testID}-yes`} />
        <AppButton variant="outline" small label={t('helpful.no')} disabled={state === 'sending'} onPress={() => answer(false)} testID={`${testID}-no`} />
      </View>
      <AppText variant="caption">{t('helpful.privacy')}</AppText>
      {error && <AppText variant="caption" live="polite">{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
