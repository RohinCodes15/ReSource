import { StyleSheet, View } from 'react-native';
import { Screen } from '../../components/Page';
import { AppText, Card, LinkText } from '../../components/ui';
import { CREDITS } from '../../legal/content';
import { useTranslation } from '../../lib/i18n';
import { colors, spacing } from '../../theme';

/** Credits & Licenses: every font, icon set, map source and dataset the app uses, with its license. */
export default function CreditsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('titles.credits')} testID="credits-screen">
      <AppText color={colors.text}>{t('credits.intro')}</AppText>
      {/* Names and license terms are kept in English so they match the licenses themselves. */}
      <View style={styles.block} {...({ lang: 'en', dir: 'ltr' } as object)}>
        {CREDITS.map((group) => (
          <View key={group.group} style={styles.block}>
            <AppText variant="h3" heading={2}>{group.group}</AppText>
            {group.items.map((item) => (
              <Card key={item.name} style={styles.item}>
                <AppText variant="h4" heading={3}>{item.name}</AppText>
                <AppText variant="bodySmall" color={colors.text}>{item.use}</AppText>
                <AppText variant="caption">{item.license}</AppText>
                <LinkText variant="caption" icon="open-in-new" label={item.url} href={item.url} />
              </Card>
            ))}
          </View>
        ))}
      </View>
      <AppText variant="bodySmall">{t('credits.projectLicense')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  item: { gap: spacing.xs },
});
