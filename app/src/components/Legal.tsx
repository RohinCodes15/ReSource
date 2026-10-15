import { StyleSheet, View } from 'react-native';
import { POLICY_EFFECTIVE_DATE, PROJECT } from '../../../shared/constants';
import type { LegalSection } from '../legal/content';
import { formatDate, useTranslation } from '../lib/i18n';
import { colors, spacing } from '../theme';
import { Screen } from './Page';
import { AppText, Banner } from './ui';

const fill = (text: string) => text.replace(/\{creator\}/g, PROJECT.creator).replace(/\{email\}/g, PROJECT.contactEmail);

/**
 * Renders a legal document. The full text is English; readers of other languages get a
 * plain-language summary in their language first, with a note saying so. (Legal text should
 * not be machine-translated without review.)
 */
export function LegalDocument({ titleKey, summaryKey, sections, testID }: { titleKey: string; summaryKey: string; sections: LegalSection[]; testID: string }) {
  const { t, language, locale } = useTranslation();
  return (
    <Screen title={t(titleKey)} testID={testID}>
      <AppText variant="caption">{t('legal.effective', { date: formatDate(POLICY_EFFECTIVE_DATE, locale) })}</AppText>
      <Banner tone="info" icon="text-box-check-outline" title={t('legal.summaryTitle')} body={t(summaryKey)} />
      {language !== 'en' && <Banner tone="warning" icon="translate" body={t('legal.englishOnly')} />}
      {/* The document itself is English, so mark it for screen readers whatever the app language is. */}
      <View style={styles.doc} {...({ lang: 'en', dir: 'ltr' } as object)}>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <AppText variant="h3" heading={2}>{section.heading}</AppText>
            {section.body.map((block, i) => typeof block === 'string'
              ? <AppText key={i} color={colors.text}>{fill(block)}</AppText>
              : (
                <View key={i} role="list" style={styles.list}>
                  {block.map((item) => (
                    <View key={item} role="listitem" style={styles.item}>
                      <AppText color={colors.text} aria-hidden>•</AppText>
                      <AppText color={colors.text} style={styles.flex}>{fill(item)}</AppText>
                    </View>
                  ))}
                </View>
              ))}
          </View>
        ))}
      </View>
      <AppText variant="caption">{t('legal.draftNote')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  doc: { gap: spacing.xl },
  section: { gap: spacing.sm },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.sm },
});
