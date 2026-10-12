import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ALERT_CATEGORIES, AREA_CODES } from '../../../../shared/constants';
import type { Alert, AlertCategory, AreaCode } from '../../../../shared/types';
import { BrowseOnly, ConsentFields, useConsent } from '../../components/ConsentFields';
import { Screen } from '../../components/Page';
import { Icon, AppButton, AppText, Banner, Card, Chip, EmptyState, ErrorState, Field, LinkText, LoadingList, Pill, Segmented, SourceLine, Toggle } from '../../components/ui';
import { ALERT_ICONS, bundledAlerts } from '../../data';
import { useApi } from '../../hooks/useData';
import { ApiError, deleteSubscription, emailSubscribe, getAlerts, getConfig, saveSubscription } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { ageStore, alertPrefsStore, type AlertPrefs, locationStore } from '../../state/stores';
import { cardSurface, colors, spacing } from '../../theme';

const SEVERITY = {
  critical: { color: colors.dangerDark, bg: colors.dangerLight, icon: 'alert-octagon' },
  warning: { color: colors.warningDark, bg: colors.warningLight, icon: 'alert' },
  info: { color: colors.navy, bg: colors.navyLight, icon: 'information' },
} as const;

/** An alert is "for me" when it matches the chosen topics and areas. Nothing chosen means everything. */
function matches(alert: Alert, prefs: AlertPrefs): boolean {
  const topic = prefs.categories.length === 0 || prefs.categories.includes(alert.category);
  const place = prefs.areas.length === 0 || alert.area === 'citywide' || prefs.areas.includes(alert.area);
  return topic && place;
}

/**
 * Phone notifications are local: the app posts one itself when it finds a new matching alert.
 * Permission is requested only here, after the person turns the switch on. Browsers get the
 * in-app feed only.
 */
async function askToNotify(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const Notifications = await import('expo-notifications');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', { name: 'Service alerts', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const current = await Notifications.getPermissionsAsync();
    const result = current.granted ? current : await Notifications.requestPermissionsAsync();
    return result.granted ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

async function notifyAbout(alerts: Alert[], title: string): Promise<void> {
  if (Platform.OS === 'web' || alerts.length === 0) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    await Notifications.scheduleNotificationAsync({ content: { title, body: alerts[0].title }, trigger: null });
  } catch {
    // Notifications are a convenience; the feed below always has the alert.
  }
}

export default function AlertsScreen() {
  const { t, tx, locale } = useTranslation();
  const { data, loading, error, reload, bundled } = useApi(getAlerts, () => bundledAlerts);
  const config = useApi(getConfig);
  const prefs = alertPrefsStore.use();
  const age = ageStore.use();
  const location = locationStore.use();
  const [view, setView] = useState<'all' | 'mine'>('all');
  const [draft, setDraft] = useState({ categories: prefs.categories, areas: prefs.areas });
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'info'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailConsent = useConsent();

  const alerts = useMemo(() => data ?? [], [data]);
  const shown = view === 'all' ? alerts : alerts.filter((alert) => matches(alert, prefs));
  const unread = alerts.filter((alert) => !prefs.read.includes(alert.id)).length;

  // Post a phone notification for matching alerts this device has not announced yet.
  useEffect(() => {
    if (!prefs.subscribed || !prefs.notifications || alerts.length === 0) return;
    const fresh = alerts.filter((alert) => matches(alert, prefs) && !prefs.notified.includes(alert.id));
    if (fresh.length === 0) return;
    void notifyAbout(fresh, t('alerts.notificationTitle'));
    alertPrefsStore.set((current) => ({ ...current, notified: [...current.notified, ...fresh.map((alert) => alert.id)] }));
  }, [alerts, prefs, t]);

  const toggleIn = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const markRead = (ids: string[]) => alertPrefsStore.set((current) => ({ ...current, read: Array.from(new Set([...current.read, ...ids])) }));

  async function subscribe() {
    setSaving(true);
    const next = { ...prefs, subscribed: true, categories: draft.categories, areas: draft.areas };
    alertPrefsStore.set(next); // saved on this device first, so it survives even if the API is down
    try {
      await saveSubscription({ categories: next.categories, areas: next.areas, notifications: next.notifications });
      setNotice({ tone: 'success', text: t('alerts.saved') });
    } catch {
      setNotice({ tone: 'warning', text: t('alerts.savedOffline') });
    }
    setSaving(false);
  }

  async function unsubscribe() {
    alertPrefsStore.set((current) => ({ ...current, subscribed: false, notifications: false }));
    setNotice({ tone: 'info', text: t('alerts.unsubscribed') });
    await deleteSubscription().catch(() => undefined);
  }

  async function setNotifications(on: boolean) {
    if (!on) { alertPrefsStore.set((current) => ({ ...current, notifications: false })); return; }
    const outcome = await askToNotify();
    alertPrefsStore.set((current) => ({ ...current, notifications: outcome === 'granted' }));
    setNotice(outcome === 'granted' ? { tone: 'success', text: t('alerts.notifyOn') } : { tone: 'warning', text: t(outcome === 'denied' ? 'alerts.notifyDenied' : 'alerts.notifyUnsupported') });
  }

  async function subscribeEmail() {
    const valid = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());
    setEmailError(valid ? null : t('alerts.emailInvalid'));
    if (!emailConsent.check() || !valid) return;
    try {
      await emailSubscribe({ email: email.trim(), categories: draft.categories, areas: draft.areas, ...emailConsent.flags() });
      setEmail('');
      emailConsent.reset();
      setNotice({ tone: 'success', text: t('alerts.emailSaved') });
    } catch (reason) {
      setNotice({ tone: 'warning', text: t(reason instanceof ApiError && reason.status === 429 ? 'errors.rateLimited' : 'errors.generic') });
    }
  }

  return (
    <Screen title={t('titles.alerts')} testID="alerts-screen">
      <Card style={styles.panel} testID="alert-preferences">
        <AppText variant="h3" heading={2}>{t('alerts.followTitle')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{t('alerts.followBody')}</AppText>
        {age === 'under13' ? <BrowseOnly /> : (
          <>
            <AppText variant="label">{t('alerts.topics')}</AppText>
            <View style={styles.chips}>
              {ALERT_CATEGORIES.map((category) => (
                <Chip key={category} label={tx('alertCategory', category)} icon={ALERT_ICONS[category]} selected={draft.categories.includes(category)}
                  onPress={() => setDraft({ ...draft, categories: toggleIn<AlertCategory>(draft.categories, category) })} testID={`topic-${category}`} />
              ))}
            </View>
            <AppText variant="label">{t('alerts.areas')}</AppText>
            <View style={styles.chips}>
              {AREA_CODES.filter((area) => area !== 'citywide').map((area) => (
                <Chip key={area} label={tx('area', area)} selected={draft.areas.includes(area)}
                  onPress={() => setDraft({ ...draft, areas: toggleIn<AreaCode>(draft.areas, area) })} testID={`area-${area}`} />
              ))}
            </View>
            {location?.area && !draft.areas.includes(location.area) && (
              <LinkText label={t('alerts.useMyArea', { area: tx('area', location.area) })} onPress={() => setDraft({ ...draft, areas: [...draft.areas, location.area as AreaCode] })} testID="use-my-area" />
            )}
            <AppText variant="caption">{t('alerts.noneMeansAll')}</AppText>
            <View style={styles.actions}>
              <AppButton variant="gold" icon="bell-check" label={t(prefs.subscribed ? 'alerts.update' : 'alerts.subscribe')} loading={saving} onPress={subscribe} style={styles.action} testID="subscribe" />
              {prefs.subscribed && <AppButton variant="outline" icon="bell-off" label={t('alerts.unsubscribe')} onPress={unsubscribe} style={styles.action} testID="unsubscribe" />}
            </View>
            {prefs.subscribed && (
              <>
                <Pill label={t('alerts.following')} icon="check-circle" color={colors.successDark} bg={colors.successLight} />
                <Toggle value={prefs.notifications} onChange={setNotifications} label={t('alerts.notifyLabel')} description={t(Platform.OS === 'web' ? 'alerts.notifyWebHint' : 'alerts.notifyHint')} testID="notify-toggle" />
              </>
            )}
            {config.data?.email_enabled && (
              <View style={styles.email}>
                <AppText variant="h4" heading={3}>{t('alerts.emailTitle')}</AppText>
                <Field label={t('alerts.emailLabel')} value={email} onChangeText={setEmail} error={emailError} keyboardType="email-address" autoComplete="email" testID="email-input" />
                <ConsentFields purpose={t('alerts.emailConsent')} consent={emailConsent} />
                <AppButton variant="outline" icon="email-plus" label={t('alerts.emailSubscribe')} onPress={subscribeEmail} testID="email-subscribe" />
              </View>
            )}
          </>
        )}
        {notice && <Banner tone={notice.tone} body={notice.text} live testID="alerts-notice" />}
      </Card>

      <View style={styles.feedHead}>
        <AppText variant="h3" heading={2} style={styles.flex}>{t('alerts.feedTitle')}</AppText>
        {unread > 0 && <LinkText label={t('alerts.markAllRead')} onPress={() => markRead(alerts.map((alert) => alert.id))} testID="mark-all-read" />}
      </View>
      <Segmented label={t('alerts.viewLabel')} value={view} onChange={setView}
        options={[{ value: 'all', label: t('alerts.viewAll', { count: alerts.length }) }, { value: 'mine', label: t('alerts.viewMine') }]} />
      <AppText variant="caption" live="polite" testID="unread-count">{t('alerts.unread', { count: unread })}</AppText>
      {bundled && <AppText variant="caption">{t('offline.savedCopy')}</AppText>}

      {loading ? <LoadingList /> : error ? <ErrorState onRetry={reload} /> : shown.length === 0 ? (
        <EmptyState icon="bell-check-outline" title={t('alerts.emptyTitle')} body={t('alerts.emptyBody')} />
      ) : shown.map((alert) => {
        const look = SEVERITY[alert.severity];
        const isRead = prefs.read.includes(alert.id);
        return (
          <View key={alert.id} style={[styles.alert, !isRead && styles.alertUnread]} testID={`alert-${alert.id}`}>
            <View style={styles.meta}>
              <Pill label={tx('alertCategory', alert.category)} icon={ALERT_ICONS[alert.category]} color={colors.navy} bg={colors.navyLight} />
              <Pill label={tx('severity', alert.severity)} icon={look.icon} color={look.color} bg={look.bg} />
              {!isRead && <Pill label={t('alerts.new')} icon="circle" color={colors.goldDark} bg={colors.goldLight} />}
            </View>
            <AppText variant="h4" heading={3}>{alert.title}</AppText>
            <AppText variant="caption">{formatDate(alert.published_at, locale)} · {tx('area', alert.area)}</AppText>
            <AppText variant="bodySmall" color={colors.text}>{alert.body}</AppText>
            <SourceLine title={alert.source_title} url={alert.source_url} retrieved={alert.retrieved} />
            {isRead ? (
              <View style={styles.readRow}><Icon name="check" size={16} color={colors.muted} /><AppText variant="caption">{t('alerts.read')}</AppText></View>
            ) : (
              <LinkText icon="check" label={t('alerts.markRead')} onPress={() => markRead([alert.id])} testID={`mark-read-${alert.id}`} />
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 180 },
  email: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  feedHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  alert: { ...cardSurface, padding: spacing.lg, gap: spacing.sm },
  alertUnread: { borderStartWidth: 4, borderStartColor: colors.gold },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
