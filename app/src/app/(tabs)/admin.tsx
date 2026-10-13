import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ServiceStatus } from '../../../../shared/types';
import { AdminGate } from '../../components/AdminGate';
import { Screen } from '../../components/Page';
import { AppButton, AppText, Banner, Card, Chip, EmptyState, ErrorState, LoadingList, Pill, Segmented, StatusBadge } from '../../components/ui';
import { useApi } from '../../hooks/useData';
import { adminDeletionRequests, adminPosts, adminReportPhoto, adminReports, closeDeletionRequest, getServices, moderatePost, moderateReport, updateServiceStatus } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { adminTokenStore } from '../../state/stores';
import { colors, spacing } from '../../theme';

type Tab = 'reports' | 'posts' | 'services' | 'requests';
const STATUSES: ServiceStatus[] = ['open', 'reduced', 'closed'];

/** Loads and shows a report's photo when the moderator asks for it. */
function ReportPhoto({ id }: { id: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<{ uri?: string; loading?: boolean; failed?: boolean }>({});
  async function load() {
    setState({ loading: true });
    try {
      setState({ uri: await adminReportPhoto(id) });
    } catch {
      setState({ failed: true });
    }
  }
  if (state.uri) return <Image source={{ uri: state.uri }} accessibilityLabel={t('admin.photoAlt')} resizeMode="contain" style={styles.photo} testID={`photo-${id}`} />;
  return (
    <>
      <AppButton variant="outline" small icon="image" label={t('admin.viewPhoto')} loading={state.loading} onPress={load} testID={`view-photo-${id}`} />
      {state.failed && <Banner tone="warning" body={t('admin.photoFailed')} live />}
    </>
  );
}

/** Runs a moderation action, then reloads the list and says what happened. */
function useAction(reload: () => void, setNotice: (text: string) => void, done: string, failed: string) {
  const [busy, setBusy] = useState<string | null>(null);
  return {
    busy,
    async run(id: string, action: () => Promise<unknown>) {
      if (busy) return;
      setBusy(id);
      try {
        await action();
        setNotice(done);
        reload();
      } catch {
        setNotice(failed);
      } finally {
        setBusy(null);
      }
    },
  };
}

function Reports({ setNotice }: { setNotice: (text: string) => void }) {
  const { t, tx, locale } = useTranslation();
  const { data, loading, error, reload } = useApi(() => adminReports('pending'), undefined, [], 0);
  const action = useAction(reload, setNotice, t('admin.saved'), t('errors.generic'));
  if (loading) return <LoadingList />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!data?.length) return <EmptyState icon="clipboard-check-outline" title={t('admin.noReports')} />;
  return (
    <>
      {data.map((report) => (
        <Card key={report.id} style={styles.block} testID={`admin-report-${report.id}`}>
          <AppText variant="h4" heading={3}>{report.service_name}</AppText>
          <AppText variant="caption">{formatDate(report.created_at, locale)} · {tx('area', report.area)} · {tx('impact', report.impact_level)}{report.has_photo ? ` · ${t('admin.hasPhoto')}` : ''}</AppText>
          <AppText color={colors.text}>{report.description}</AppText>
          {report.has_photo && <ReportPhoto id={report.id} />}
          <View style={styles.actions}>
            <AppButton variant="navy" small icon="check" label={t('admin.verify')} loading={action.busy === report.id} onPress={() => action.run(report.id, () => moderateReport(report.id, 'verified'))} style={styles.action} testID={`verify-${report.id}`} />
            <AppButton variant="danger" small icon="close" label={t('admin.reject')} onPress={() => action.run(report.id, () => moderateReport(report.id, 'rejected'))} style={styles.action} testID={`reject-${report.id}`} />
          </View>
        </Card>
      ))}
    </>
  );
}

function Posts({ setNotice }: { setNotice: (text: string) => void }) {
  const { t, tx, locale } = useTranslation();
  const { data, loading, error, reload } = useApi(() => adminPosts('all'), undefined, [], 0);
  const action = useAction(reload, setNotice, t('admin.saved'), t('errors.generic'));
  if (loading) return <LoadingList />;
  if (error) return <ErrorState onRetry={reload} />;
  const posts = (data ?? []).filter((post) => !post.is_sample);
  if (!posts.length) return <EmptyState icon="forum-outline" title={t('admin.noPosts')} />;
  return (
    <>
      {posts.map((post) => (
        <Card key={post.id} style={styles.block} testID={`admin-post-${post.id}`}>
          <View style={styles.actions}>
            <Pill label={tx('postStatus', post.status)} color={colors.navy} bg={colors.navyLight} />
            {post.flags > 0 && <Pill label={t('admin.flags', { count: post.flags })} icon="flag" color={colors.warningDark} bg={colors.warningLight} />}
          </View>
          <AppText color={colors.text}>{post.body}</AppText>
          <AppText variant="caption">{formatDate(post.created_at, locale)} · {tx('area', post.area)}</AppText>
          <View style={styles.actions}>
            {post.status !== 'approved' && <AppButton variant="navy" small icon="check" label={t('admin.approve')} onPress={() => action.run(post.id, () => moderatePost(post.id, 'approved'))} style={styles.action} testID={`approve-${post.id}`} />}
            {post.status !== 'rejected' && <AppButton variant="danger" small icon="close" label={t('admin.reject')} onPress={() => action.run(post.id, () => moderatePost(post.id, 'rejected'))} style={styles.action} testID={`reject-post-${post.id}`} />}
          </View>
        </Card>
      ))}
    </>
  );
}

function Services({ setNotice }: { setNotice: (text: string) => void }) {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useApi(getServices);
  const action = useAction(reload, setNotice, t('admin.saved'), t('errors.generic'));
  if (loading) return <LoadingList />;
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <>
      <Banner tone="warning" body={t('admin.statusWarning')} />
      {(data ?? []).map((service) => (
        <Card key={service.id} style={styles.block} testID={`admin-service-${service.id}`}>
          <AppText variant="h4" heading={3}>{service.name}</AppText>
          <StatusBadge status={service.status} />
          <View style={styles.actions} role="radiogroup" accessibilityLabel={t('admin.setStatus', { name: service.name })}>
            {STATUSES.map((status) => (
              <Chip key={status} role="radio" label={t(`status.${status}`)} selected={service.status === status} onPress={() => action.run(service.id, () => updateServiceStatus(service.id, status))} testID={`set-${service.id}-${status}`} />
            ))}
          </View>
        </Card>
      ))}
    </>
  );
}

function Requests({ setNotice }: { setNotice: (text: string) => void }) {
  const { t, locale } = useTranslation();
  const { data, loading, error, reload } = useApi(adminDeletionRequests, undefined, [], 0);
  const action = useAction(reload, setNotice, t('admin.saved'), t('errors.generic'));
  if (loading) return <LoadingList />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!data?.length) return <EmptyState icon="account-check-outline" title={t('admin.noRequests')} />;
  return (
    <>
      {data.map((request) => (
        <Card key={request.id} style={styles.block}>
          <AppText variant="caption">{formatDate(request.created_at, locale)} · {t(`admin.requestStatus_${request.status}`)}</AppText>
          {!!request.contact_email && <AppText variant="label" selectable>{request.contact_email}</AppText>}
          <AppText color={colors.text}>{request.details}</AppText>
          {request.status === 'open' && <AppButton variant="navy" small icon="check" label={t('admin.markDone')} onPress={() => action.run(request.id, () => closeDeletionRequest(request.id))} />}
        </Card>
      ))}
    </>
  );
}

/** Admin tools: review reports and posts, update a service's status, and close deletion requests. */
export default function AdminScreen() {
  const { t } = useTranslation();
  const token = adminTokenStore.use();
  const [tab, setTab] = useState<Tab>('reports');
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Screen title={t('titles.admin')} testID="admin-screen">
      <AdminGate>
        {token ? (
          <View style={styles.block}>
            <Segmented label={t('titles.admin')} value={tab} onChange={(next) => { setTab(next); setNotice(null); }} options={(['reports', 'posts', 'services', 'requests'] as const).map((value) => ({ value, label: t(`admin.tab_${value}`) }))} />
            {notice && <Banner tone="info" body={notice} live testID="admin-notice" />}
            {tab === 'reports' && <Reports setNotice={setNotice} />}
            {tab === 'posts' && <Posts setNotice={setNotice} />}
            {tab === 'services' && <Services setNotice={setNotice} />}
            {tab === 'requests' && <Requests setNotice={setNotice} />}
          </View>
        ) : null}
      </AdminGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
  photo: { width: '100%', height: 240, backgroundColor: colors.background },
});
