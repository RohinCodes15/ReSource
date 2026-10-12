import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Dialog, Portal, TextInput } from 'react-native-paper';
import type { Post } from '../../../../shared/types';
import { Page } from '../../components/Page';
import { AppButton, NATIVE_DRIVER, Pill } from '../../components/ui';
import { initialPosts } from '../../data';
import { cardSurface, colors, fonts, radius, SCREEN_PADDING, spacing, type } from '../../theme';

const MAX_POST = 280;

/** One post. The upvote button and its count bounce when tapped. */
function PostCard({ post, onVote }: { post: Post; onVote: () => void }) {
  const bounce = useRef(new Animated.Value(1)).current;

  function vote() {
    Animated.sequence([
      Animated.timing(bounce, { toValue: 1.3, duration: 110, useNativeDriver: NATIVE_DRIVER }),
      Animated.spring(bounce, { toValue: 1, friction: 3, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
    onVote();
  }

  return (
    <View style={styles.card}>
      <Pressable
        onPress={vote}
        accessibilityRole="button"
        accessibilityState={{ selected: post.upvoted }}
        accessibilityLabel={`${post.upvoted ? 'Remove upvote' : 'Upvote'}. ${post.votes} votes`}
        style={[styles.vote, post.upvoted && styles.voteActive]}
      >
        <Animated.View style={[styles.voteInner, { transform: [{ scale: bounce }] }]}>
          <MaterialCommunityIcons name="arrow-up-bold" size={22} color={post.upvoted ? colors.goldDark : colors.muted} />
          <Text style={[styles.voteCount, post.upvoted && styles.voteCountActive]}>{post.votes}</Text>
        </Animated.View>
      </Pressable>
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={type.label}>{post.author}</Text>
          {/* Sample posts carry the badge; a post you write here does not. */}
          {post.author !== 'You' && (
            <Pill label="Verified Resident" icon="check-decagram" color={colors.successDark} bg={colors.successLight} />
          )}
        </View>
        <Text style={styles.text}>{post.text}</Text>
        <Text style={type.caption}>{post.neighborhood} · {post.time}</Text>
      </View>
    </View>
  );
}

export default function CommunityScreen() {
  const [posts, setPosts] = useState(initialPosts);
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [neighborhood, setNeighborhood] = useState('');

  const data = useMemo(
    () => (sort === 'top' ? [...posts].sort((a, b) => b.votes - a.votes) : posts),
    [posts, sort],
  );

  const toggleVote = (id: string) =>
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upvoted: !p.upvoted, votes: p.votes + (p.upvoted ? -1 : 1) } : p)),
    );

  function publish() {
    if (!text.trim()) return;
    setPosts((prev) => [
      {
        id: `p${Date.now()}`,
        author: 'You',
        neighborhood: neighborhood.trim() || 'Fremont',
        text: text.trim(),
        votes: 1,
        time: 'Just now',
        upvoted: true,
      },
      ...prev,
    ]);
    setText('');
    setNeighborhood('');
    setComposing(false);
  }

  return (
    <Page>
      <FlatList
        data={data}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={type.bodySmall}>Tips and questions from Fremont neighbors.</Text>
            <View style={styles.tabs}>
              {(['top', 'new'] as const).map((key) => {
                const active = sort === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSort(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{key === 'top' ? 'Top' : 'New'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} onVote={() => toggleVote(item.id)} />}
      />

      <Pressable
        onPress={() => setComposing(true)}
        accessibilityRole="button"
        accessibilityLabel="New post"
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <MaterialCommunityIcons name="plus" size={30} color={colors.navyDark} />
      </Pressable>

      <Portal>
        <Dialog visible={composing} onDismiss={() => setComposing(false)} style={styles.dialog}>
          <Dialog.Title>Share a tip</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <View>
              <TextInput
                mode="outlined"
                label="Your tip or question"
                value={text}
                onChangeText={setText}
                maxLength={MAX_POST}
                multiline
                numberOfLines={4}
                outlineStyle={styles.outline}
                style={styles.input}
              />
              <Text style={[styles.counter, text.length >= MAX_POST && styles.counterFull]}>{text.length}/{MAX_POST}</Text>
            </View>
            <TextInput
              mode="outlined"
              label="Neighborhood (optional)"
              value={neighborhood}
              onChangeText={setNeighborhood}
              outlineStyle={styles.outline}
              style={styles.input}
            />
            <View style={styles.dialogActions}>
              <AppButton variant="outline" label="Cancel" onPress={() => setComposing(false)} style={styles.dialogButton} />
              <AppButton variant="gold" icon="send" label="Post" disabled={!text.trim()} onPress={publish} style={styles.dialogButton} />
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </Page>
  );
}

const styles = StyleSheet.create({
  list: { padding: SCREEN_PADDING, gap: spacing.md, paddingBottom: 112 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3 },
  tab: { paddingHorizontal: spacing.xl, height: 36, borderRadius: 10, justifyContent: 'center' },
  tabActive: { ...cardSurface, borderRadius: 10 },
  tabText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  tabTextActive: { fontFamily: fonts.semibold, color: colors.text },
  card: { ...cardSurface, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  vote: { width: 52, minHeight: 64, borderRadius: radius.md, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  voteActive: { backgroundColor: colors.goldLight },
  voteInner: { alignItems: 'center' },
  voteCount: { fontFamily: fonts.bold, fontSize: 14, color: colors.muted },
  voteCountActive: { color: colors.goldDark },
  body: { flex: 1, gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.text },
  fab: {
    position: 'absolute',
    right: SCREEN_PADDING,
    bottom: SCREEN_PADDING,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.goldDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: { transform: [{ scale: 0.94 }] },
  dialog: { borderRadius: radius.xl, backgroundColor: colors.surface },
  dialogContent: { gap: spacing.md },
  input: { backgroundColor: colors.surface },
  outline: { borderRadius: radius.md },
  counter: { ...type.caption, textAlign: 'right', marginTop: spacing.xs },
  counterFull: { color: colors.dangerDark },
  dialogActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  dialogButton: { flex: 1 },
});
