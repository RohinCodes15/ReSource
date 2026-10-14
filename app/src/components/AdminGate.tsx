import { PropsWithChildren, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useApi } from '../hooks/useData';
import { adminCheck, ApiError, getConfig } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { adminTokenStore } from '../state/stores';
import { colors, spacing } from '../theme';
import { AppButton, AppText, Banner, Card, Field } from './ui';

/**
 * Wraps the staff-only screens. The passcode is checked by the API on every request; this
 * component only decides what to draw. It is kept in memory, so closing the app locks it again.
 */
export function AdminGate({ children, body }: PropsWithChildren<{ body?: string }>) {
  const { t } = useTranslation();
  const token = adminTokenStore.use();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const config = useApi(getConfig);

  async function unlock() {
    if (!input.trim() || checking) return;
    setChecking(true);
    setError(null);
    adminTokenStore.set(input.trim());
    try {
      await adminCheck();
      setInput('');
    } catch (reason) {
      adminTokenStore.set('');
      const status = reason instanceof ApiError ? reason.status : 0;
      setError(t(status === 0 ? 'admin.offline' : status === 403 ? 'admin.wrong' : status === 429 ? 'errors.rateLimited' : 'errors.generic'));
    } finally {
      setChecking(false);
    }
  }

  if (!token && config.data?.admin_enabled === false) {
    return (
      <Card style={styles.block} testID="admin-not-set-up">
        <AppText variant="h3" heading={2}>{t('admin.lockedTitle')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{t('admin.notSetUp')}</AppText>
      </Card>
    );
  }
  if (!token) {
    return (
      <Card style={styles.block} testID="admin-gate">
        <AppText variant="h3" heading={2}>{t('admin.lockedTitle')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{body ?? t('admin.lockedBody')}</AppText>
        <Field label={t('admin.passcode')} value={input} onChangeText={setInput} secure error={error} onSubmitEditing={unlock} autoComplete="off" testID="admin-passcode" />
        <AppButton variant="navy" icon="lock-open-variant" label={t('admin.unlock')} loading={checking} onPress={unlock} testID="admin-unlock" />
      </Card>
    );
  }
  return (
    <View style={styles.block}>
      <Banner tone="success" icon="shield-check" body={t('admin.unlocked')}>
        <AppButton variant="outline" small icon="lock" label={t('admin.lock')} onPress={() => adminTokenStore.set('')} testID="admin-lock" />
      </Banner>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ block: { gap: spacing.md } });
