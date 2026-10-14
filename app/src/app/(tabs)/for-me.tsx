import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { Service } from '../../../../shared/types';
import { LocationChip } from '../../components/LocationChip';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Banner, Card, Chip, type IconName, LinkText, LoadingList, Pill, SourceLine, StatusBadge } from '../../components/ui';
import { bundledResources, bundledServices } from '../../data';
import { useApi } from '../../hooks/useData';
import { getResources, getServices } from '../../lib/api';
import { formatDate, formatMoney, useTranslation } from '../../lib/i18n';
import { printHtml, shareText } from '../../lib/platform';
import { locationStore } from '../../state/stores';
import { colors, spacing } from '../../theme';
import { type CardLabels, type ForMeSection, impactCardHtml, impactCardText, inMyArea, INTERESTS, type Interest, RESOURCE_CATEGORIES, whatChangedForMe } from '../../utils/forMe';

const ICONS: Record<Interest, IconName> = { kids: 'account-child', seniors: 'human-cane', transit: 'road-variant', health: 'hospital-box', parks: 'tree' };

/**
 * "What changed for me?": the person picks an area and interests and gets the matching rows of
 * the service data, each with its source. Choices are kept in this screen only; nothing is sent.
 */
export default function ForMeScreen() {
  const { t, tx, locale, language, isRTL } = useTranslation();
  const router = useRouter();
  const location = locationStore.use();
  const services = useApi(getServices, () => bundledServices);
  const resources = useApi(getResources, () => bundledResources);
  const [picked, setPicked] = useState<Interest[]>([]);
  const [shown, setShown] = useState<Interest[] | null>(null);
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const area = location?.area ?? null;
  const sections = useMemo(
    () => (shown ? whatChangedForMe(services.data ?? [], resources.data ?? [], area, shown) : []),
    [shown, services.data, resources.data, area],
  );

  const toggle = (interest: Interest) => {
    setPicked((current) => (current.includes(interest) ? current.filter((value) => value !== interest) : [...current, interest]));
    setNotice(null);
  };
  const show = () => {
    setTouched(true);
    setNotice(null);
    if (picked.length) setShown(picked);
  };

  const sectionTitle = (key: ForMeSection['key']) => t(key === 'everyone' ? 'forMe.everyone' : `forMe.interest_${key}`);
  const amountText = (service: Service) => (service.cut_amount != null ? t('forMe.amount', { amount: formatMoney(service.cut_amount) }) : service.cut_amount_note ?? t('forMe.noAmount'));
  const sinceText = (service: Service) => (service.effective_date ? t('forMe.since', { date: formatDate(service.effective_date, locale) }) : t('forMe.noDate'));

  async function makeCard() {
    const labels: CardLabels = {
      title: t('forMe.cardTitle'),
      area: t('forMe.cardArea', { area: tx('area', area ?? 'citywide') }),
      date: t('forMe.cardDate', { date: formatDate(new Date().toISOString(), locale) }),
      footer: t('forMe.cardFooter'),
      englishNote: t('forMe.englishNote'),
      noChange: t('forMe.noChange'),
      noData: t('forMe.noData'),
      source: (title) => t('common.source', { title }),
      section: sectionTitle,
      status: (service) => t(`status.${service.status}`),
      amount: amountText,
      since: sinceText,
    };
    if (Platform.OS === 'web') {
      setNotice(printHtml(impactCardHtml(sections, labels, { lang: language, rtl: isRTL }), 'impact-card') ? null : t('forMe.cardFailed'));
      return;
    }
    const outcome = await shareText(labels.title, impactCardText(sections, labels));
    setNotice(outcome === 'failed' ? t('forMe.cardFailed') : outcome === 'copied' ? t('forMe.cardCopied') : null);
  }

  return (
    <Screen title={t('titles.forMe')} testID="for-me-screen">
      <AppText color={colors.text}>{t('forMe.intro')}</AppText>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('forMe.step1')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{t('forMe.areaHelp')}</AppText>
        <LocationChip />
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3" heading={2}>{t('forMe.step2')}</AppText>
        <View style={styles.chips} role="group" accessibilityLabel={t('forMe.interestsLabel')}>
          {INTERESTS.map((interest) => (
            <Chip key={interest} label={t(`forMe.interest_${interest}`)} icon={ICONS[interest]} selected={picked.includes(interest)} onPress={() => toggle(interest)} testID={`interest-${interest}`} />
          ))}
        </View>
        {touched && picked.length === 0 && <AppText variant="caption" color={colors.dangerDark} live="polite" testID="for-me-error">{t('forMe.pickOne')}</AppText>}
        <AppButton variant="gold" icon="text-box-search" label={t('forMe.show')} onPress={show} testID="for-me-show" />
      </Card>

      {shown && (services.loading || resources.loading) && <LoadingList />}
      {shown && !services.loading && !resources.loading && (
        <View style={styles.block} testID="for-me-results">
          <AppText variant="h2" heading={2} live="polite">{t('forMe.resultsTitle')}</AppText>
          <AppText variant="caption">{t('forMe.cardArea', { area: tx('area', area ?? 'citywide') })}</AppText>
          {(services.bundled || resources.bundled) && <AppText variant="caption">{t('offline.savedCopy')}</AppText>}
          <Banner tone="info" icon="translate" body={t('forMe.englishNote')} />

          {sections.map((section) => (
            <Card key={section.key} style={styles.block} testID={`for-me-section-${section.key}`}>
              <AppText variant="h3" heading={3}>{sectionTitle(section.key)}</AppText>
              {section.key === 'transit' && <AppText variant="bodySmall" color={colors.text}>{t('forMe.transitNote')}</AppText>}
              {section.noData && <AppText variant="bodySmall" color={colors.text} testID={`for-me-nodata-${section.key}`}>{t('forMe.noData')}</AppText>}
              {!section.noData && section.changed.length === 0 && <AppText variant="bodySmall" color={colors.text} testID={`for-me-nochange-${section.key}`}>{t('forMe.noChange')}</AppText>}

              {[...section.changed, ...section.unchanged].map((service) => (
                <View key={service.id} style={styles.item} testID={`for-me-${service.id}`}>
                  <View style={styles.pills}>
                    <StatusBadge status={service.status} />
                    {inMyArea(service, area) && <Pill label={t('forMe.inYourArea')} icon="map-marker" color={colors.navy} bg={colors.navyLight} />}
                  </View>
                  <AppText variant="h4" heading={4}>{service.name}</AppText>
                  <AppText color={colors.text}>{service.summary}</AppText>
                  {service.status !== 'open' && <AppText variant="bodySmall" color={colors.text}>{amountText(service)} {sinceText(service)}</AppText>}
                  <SourceLine title={service.source_title} url={service.source_url} retrieved={service.retrieved} />
                </View>
              ))}

              {section.resources.length > 0 && (
                <View style={styles.item}>
                  <AppText variant="h4" heading={4}>{t('forMe.help')}</AppText>
                  {section.resources.map((resource) => (
                    <View key={resource.id} style={styles.resource}>
                      <AppText variant="label">{resource.name}</AppText>
                      {!!resource.phone && <AppText variant="bodySmall" color={colors.text}>{resource.phone}</AppText>}
                      <SourceLine title={t('resources.sourceLabel')} url={resource.source_url ?? resource.website} retrieved={resource.retrieved} />
                    </View>
                  ))}
                  <LinkText
                    icon="hand-heart"
                    label={t('forMe.seeResources')}
                    onPress={() => router.push({ pathname: '/resources', params: { categories: RESOURCE_CATEGORIES[section.key].join(','), at: String(Date.now()) } } as never)}
                    testID={`for-me-resources-${section.key}`}
                  />
                </View>
              )}
            </Card>
          ))}

          <AppText variant="caption">{t('forMe.cardPrivacy')}</AppText>
          <AppButton variant="navy" icon={Platform.OS === 'web' ? 'printer' : 'share-variant'} label={t(Platform.OS === 'web' ? 'forMe.print' : 'forMe.share')} onPress={makeCard} testID="for-me-card" />
          {notice && <Banner tone="info" body={notice} live />}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: { gap: spacing.xs, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  resource: { gap: 2 },
});
