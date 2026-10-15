import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AREA_CODES } from '../../../../shared/constants';
import type { AreaCode, Post } from '../../../../shared/types';
import { BrowseOnly, ConsentFields, useConsent } from '../../components/ConsentFields';
import { Screen } from '../../components/Page';
import { Sheet } from '../../components/Sheet';
import { Icon, a11yState, AppButton, AppText, Banner, Card, Chip, EmptyState, ErrorState, Field, LinkText, LoadingList, Pill, Segmented } from '../../components/ui';
import { bundledPosts } from '../../data';
import { useApi } from '../../hooks/useData';
import { ApiError, createPost, deletePost, flagPost, getPosts, votePost } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { ageStore, locationStore } from '../../state/stores';
import { colors, MIN_TOUCH, radius, spacing } from '../../theme';

const MAX_POST = 280;
type Notice = { tone: 'success' | 'warning' | 'info'; text: string };

/** Community Board: short tips from neighbors, with one upvote each, abuse reports and moderation. */
export default function CommunityScreen() {
  const { t, tx, locale } = useTranslation();
  const age = ageStore.use();
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const { data, loading, error, reload, bundled } = useApi(() => getPosts(sort), () => bundledPosts.map((p) => ({ ...p, mine: false, voted: false })), [sort]);
  const consent = useConsent();
  const [body, setBody] = useState('');
  const [area, setArea] = useState<AreaCode>(locationStore.get()?.area ?? 'citywide');
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [local, setLocal] = useState<Record<string, Partial<Post>>>({});
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'flag'; post: Post } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // A vote shows at once from `local`; fresh data from the server replaces it.
  const [seenData, setSeenData] = useState(data);
  if (data !== seenData) {
    setSeenData(data);
    setLocal({});
  }
  const posts = (data ?? []).map((post) => ({ ...post, ...local[post.id] }));
  const failed = (reason: unknown) => setNotice({ tone: 'warning', text: t(reason instanceof ApiError && reason.status === 429 ? 'errors.rateLimited' : reason instanceof ApiError && reason.code === 'network_already_voted' ? 'community.networkVoted' : reason instanceof ApiError && reason.isNetwork ? 'community.offline' : 'errors.generic') });

  async function publish() {
    const text = body.trim();
    setBodyError(text.length < 3 ? t('community.tooShort') : null);
    if (!consent.check() || text.length < 3 || posting) return;
    setPosting(true);
    try {
      const created = await createPost({ body: text, area, ...consent.flags() });
      setBody('');
      consent.reset();
      setNotice({ tone: created.status === 'pending' ? 'info' : 'success', text: t(created.status === 'pending' ? 'community.held' : created.pii_removed.length ? 'community.postedScrubbed' : 'community.posted') });
      reload();
    } catch (reason) {
      failed(reason);
    } finally {
      setPosting(false);
    }
  }

  async function vote(post: Post) {
    if (busyId) return; // one request at a time, so a fast double tap cannot count twice
    setBusyId(post.id);
    try {
      const result = await votePost(post.id);
      setLocal((current) => ({ ...current, [post.id]: { upvotes: result.upvotes, voted: result.voted } }));
    } catch (reason) {
      failed(reason);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmAction() {
    if (!confirm) return;
    const { kind, post } = confirm;
    setConfirm(null);
    try {
      if (kind === 'delete') {
        await deletePost(post.id);
        setNotice({ tone: 'success', text: t('community.deleted') });
        reload();
      } else {
        await flagPost(post.id);
        setNotice({ tone: 'success', text: t('community.flagged') });
      }
    } catch (reason) {
      failed(reason);
    }
  }

  return (
    <Screen title={t('titles.community')} testID="community-screen">
      <AppText variant="bodySmall" color={colors.text}>{t('community.intro')}</AppText>
      <Card style={styles.block} testID="post-form">
        <AppText variant="h4" heading={2}>{t('community.shareTip')}</AppText>
        {age === 'under13' ? <BrowseOnly /> : (
          <>
            <Field label={t('community.tipLabel')} hint={t('community.rules')} value={body} onChangeText={setBody} multiline maxLength={MAX_POST} error={bodyError} testID="post-body" />
            <AppText variant="label">{t('community.areaLabel')}</AppText>
            <View style={styles.chips} role="radiogroup" accessibilityLabel={t('community.areaLabel')}>
              {AREA_CODES.map((code) => <Chip key={code} role="radio" label={tx('area', code)} selected={area === code} onPress={() => setArea(code)} testID={`post-area-${code}`} />)}
            </View>
            <ConsentFields purpose={t('community.consent')} consent={consent} />
            <AppButton variant="gold" icon="send" label={t('community.post')} loading={posting} onPress={publish} testID="post-submit" />
          </>
        )}
      </Card>
      {notice && <Banner tone={notice.tone} body={notice.text} live testID="community-notice" />}

      <Segmented label={t('community.sortLabel')} value={sort} onChange={setSort} options={[{ value: 'top', label: t('community.top') }, { value: 'new', label: t('community.new') }]} />
      {bundled && <AppText variant="caption">{t('community.offline')}</AppText>}

      {loading ? <LoadingList /> : error ? <ErrorState onRetry={reload} /> : posts.length === 0 ? (
        <EmptyState art="lake" icon="forum-outline" title={t('community.emptyTitle')} body={t('community.emptyBody')} />
      ) : posts.map((post) => (
        <Card key={post.id} style={styles.post} testID={`post-${post.id}`}>
          <Pressable
            onPress={() => vote(post)}
            disabled={bundled || age === 'under13' || busyId === post.id}
            accessibilityRole="button"
            aria-pressed={!!post.voted}
            accessibilityState={a11yState({ selected: !!post.voted, disabled: bundled || age === 'under13' })}
            accessibilityLabel={t(post.voted ? 'community.removeVote' : 'community.upvote', { count: post.upvotes })}
            testID={`vote-${post.id}`}
            style={[styles.vote, post.voted && styles.voteOn]}
          >
            <Icon name={post.voted ? 'arrow-up-bold' : 'arrow-up-bold-outline'} size={22} color={post.voted ? colors.white : colors.navy} />
            <AppText variant="label" color={post.voted ? colors.white : colors.navy} testID={`votes-${post.id}`}>{post.upvotes}</AppText>
          </Pressable>
          <View style={styles.postBody}>
            <View style={styles.meta}>
              {post.is_sample && <Pill label={t('community.samplePost')} icon="flask-outline" color={colors.warningDark} bg={colors.warningLight} />}
              {post.mine && <Pill label={t('community.yours')} icon="account" color={colors.navy} bg={colors.navyLight} />}
            </View>
            <AppText>{post.body}</AppText>
            <AppText variant="caption">{tx('area', post.area)} · {formatDate(post.created_at, locale)}</AppText>
            {!bundled && !post.is_sample && age !== 'under13' && (
              <View style={styles.meta}>
                {post.mine
                  ? <LinkText icon="delete-outline" color={colors.dangerDark} label={t('community.delete')} onPress={() => setConfirm({ kind: 'delete', post })} testID={`delete-${post.id}`} />
                  : <LinkText icon="flag-outline" label={t('community.report')} onPress={() => setConfirm({ kind: 'flag', post })} testID={`flag-${post.id}`} />}
              </View>
            )}
          </View>
        </Card>
      ))}

      <Sheet visible={!!confirm} onClose={() => setConfirm(null)} title={t(confirm?.kind === 'delete' ? 'community.deleteTitle' : 'community.reportTitle')} testID="confirm-sheet">
        <AppText color={colors.text}>{t(confirm?.kind === 'delete' ? 'community.deleteBody' : 'community.reportBody')}</AppText>
        <View style={styles.block}>
          <AppButton variant={confirm?.kind === 'delete' ? 'danger' : 'navy'} label={t(confirm?.kind === 'delete' ? 'community.delete' : 'community.report')} onPress={confirmAction} testID="confirm-yes" />
          <AppButton variant="outline" label={t('common.cancel')} onPress={() => setConfirm(null)} testID="confirm-no" />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  post: { flexDirection: 'row', gap: spacing.md },
  postBody: { flex: 1, gap: spacing.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vote: { width: 52, minHeight: MIN_TOUCH + 16, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.navy, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  voteOn: { backgroundColor: colors.navy },
});
