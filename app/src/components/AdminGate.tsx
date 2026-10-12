import { PropsWithChildren, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { adminCheck, ApiError } from '../lib/api';
import { useTranslation } from '../lib/i18n';
import { adminTokenStore } from '../state/stores';
import { colors, spacing } from '../theme';
import { AppButton, AppText, Banner, Card, Field } from './ui';

/**
 * Wraps the staff-only screens. The passcode is checked by the API on every request; this
 * component only decides what to draw. It is kept in memory, so closing the app locks it again.
 */
export function AdminGate({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const token = adminTokenStore.use();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

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
      setError(t(reason instanceof ApiError && reason.isNetwork ? 'admin.offline' : 'admin.wrong'));
    } finally {
      setChecking(false);
    }
  }

  if (!token) {
    return (
      <Card style={styles.block} testID="admin-gate">
        <AppText variant="h3" heading={2}>{t('admin.lockedTitle')}</AppText>
        <AppText variant="bodySmall" color={colors.text}>{t('admin.lockedBody')}</AppText>
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
