import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { BrowseOnly } from '../../components/ConsentFields';
import { HelpfulPrompt } from '../../components/HelpfulPrompt';
import { LocationChip } from '../../components/LocationChip';
import { Screen } from '../../components/Page';
import { Icon, AppButton, AppText, Banner, Chip, LinkText, Pill } from '../../components/ui';
import { bundledResources, bundledServices } from '../../data';
import { ApiError, sendChat } from '../../lib/api';
import { useTranslation } from '../../lib/i18n';
import { telUrl } from '../../lib/platform';
import { ageStore, type ChatMessage, chatStore, locationStore } from '../../state/stores';
import { colors, fonts, MIN_TOUCH, radius, SCREEN_PADDING, spacing } from '../../theme';

// Starter questions shown before the first message, translated under "chat" in the locale files.
const SUGGESTIONS = ['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4'];
const MAX_HISTORY_TURNS = 20;
const MAX_LENGTH = 1000;
/** Places an answer can name, by name: what is needed to call one or show it on the map. */
const PLACES = new Map<string, { id: string; phone: string | null; mappable: boolean }>([
  ...bundledServices.map((s) => [s.name, { id: s.id, phone: s.phone, mappable: s.lat != null }] as const),
  ...bundledResources.map((r) => [r.name, { id: r.id, phone: r.phone || null, mappable: r.lat != null }] as const),
]);
const MAX_PLACE_ACTIONS = 3;

/** Call and Map buttons for the first few places an answer names, so a resident can act on it. */
function PlaceActions({ sources }: { sources: string[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const places = sources.flatMap((name) => {
    const place = PLACES.get(name);
    return place && (place.phone || place.mappable) ? [{ name, ...place }] : [];
  }).slice(0, MAX_PLACE_ACTIONS);
  if (!places.length) return null;
  return (
    <View style={styles.places} testID="chat-places">
      {places.map((place) => (
        <View key={place.id} style={styles.place}>
          <AppText variant="caption" color={colors.text} style={styles.placeName}>{place.name}</AppText>
          {!!place.phone && <AppButton variant="outline" small icon="phone" label={place.phone} accessibilityLabel={t('chat.callPlace', { name: place.name, phone: place.phone })} href={telUrl(place.phone)} testID={`chat-call-${place.id}`} />}
          {place.mappable && <AppButton variant="outline" small icon="map-marker" label={t('chat.map')} accessibilityLabel={t('chat.mapPlace', { name: place.name })} onPress={() => router.push({ pathname: '/map', params: { service: place.id } } as never)} testID={`chat-map-${place.id}`} />}
        </View>
      ))}
    </View>
  );
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function ChatScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const messages = chatStore.use();
  const location = locationStore.use();
  const age = ageStore.use();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // An empty answer with no request behind it is left over from a reload or a closed app while
  // the answer was being written. Offer "Try again" instead of waiting forever.
  useEffect(() => {
    if (abortRef.current || !messages.some((m) => m.role === 'assistant' && !m.failed && m.content === '')) return;
    chatStore.set((all) => all.map((m) => (m.role === 'assistant' && !m.failed && m.content === '' ? { ...m, failed: true } : m)));
  }, [messages]);

  // Keep the newest message in view as it grows.
  const lastText = messages[messages.length - 1]?.content ?? '';
  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(timer);
  }, [messages.length, lastText.length]);
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Sends `text`, or when `retryOf` is given, asks again for the answer that failed. */
  async function send(text: string, retryOf?: string) {
    const question = text.trim().slice(0, MAX_LENGTH);
    if (!question || busy) return;
    setError(null);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const answerId = newId();
    const earlier = chatStore.get().filter((m) => !m.failed && m.id !== retryOf && m.content.trim().length > 0);
    const base = retryOf ? earlier : [...earlier, { id: newId(), role: 'user' as const, content: question }];
    chatStore.set([...base, { id: answerId, role: 'assistant', content: '' }]);
    const update = (changes: Partial<ChatMessage>) => chatStore.set((all) => all.map((m) => (m.id === answerId ? { ...m, ...changes } : m)));
    try {
      const result = await sendChat(
        {
          // Earlier turns of this conversation, so the assistant remembers what was already said.
          messages: base.map(({ role, content }) => ({ role, content })).slice(-MAX_HISTORY_TURNS),
          language, // the server tells the model to answer in this language
          ...(location ? { latitude: location.lat, longitude: location.lng, area_label: location.label } : null),
        },
        { signal: controller.signal, onText: (content) => update({ content }) },
      );
      update({ content: result.reply, sources: result.sources, mode: result.mode });
    } catch (reason) {
      const code = reason instanceof ApiError ? reason.code : 'network';
      if (code === 'aborted') {
        // "Stop" keeps whatever had arrived; an answer with no text yet is simply removed.
        chatStore.set((all) => all.filter((m) => m.id !== answerId || m.content.trim().length > 0));
      } else {
        update({ failed: true, content: '' });
        setError(t(reason instanceof ApiError && reason.status === 429 ? 'errors.rateLimited' : 'chat.failed'));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function retry(failedId: string) {
    const all = chatStore.get();
    const index = all.findIndex((m) => m.id === failedId);
    const question = all.slice(0, index).reverse().find((m) => m.role === 'user');
    if (question) void send(question.content, failedId);
  }

  const clear = () => { abortRef.current?.abort(); chatStore.set([]); setError(null); };
  const canSend = !!input.trim() && !busy;

  const composer = age === 'under13' ? <View style={styles.composer}><BrowseOnly /></View> : (
    <View style={styles.composer}>
      {messages.length === 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {SUGGESTIONS.map((key) => <Chip key={key} label={t(key)} onPress={() => send(t(key))} testID={`suggestion-${key.slice(-2)}`} />)}
        </ScrollView>
      )}
      {!!error && <Banner tone="warning" body={error} live testID="chat-error" />}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          maxLength={MAX_LENGTH}
          accessibilityLabel={t('chat.messageLabel')}
          testID="chat-input"
        />
        {busy ? (
          <Pressable onPress={() => abortRef.current?.abort()} accessibilityRole="button" accessibilityLabel={t('chat.stop')} testID="chat-stop" style={[styles.send, styles.stop]}>
            <Icon name="stop" size={22} color={colors.white} />
          </Pressable>
        ) : (
          <Pressable onPress={() => send(input)} disabled={!canSend} accessibilityRole="button" accessibilityLabel={t('chat.send')} accessibilityState={{ disabled: !canSend }} testID="chat-send" style={[styles.send, !canSend && styles.sendDisabled]}>
            <Icon name="arrow-up" size={22} color={colors.white} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Screen title={t('titles.chat')} scroll={false} footer={false} testID="chat-screen">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Banner tone="info" icon="robot-outline" title={t('chat.noticeTitle')} body={t('chat.noticeBody')} testID="chat-notice">
                <LinkText variant="caption" label={t('consent.readPrivacy')} onPress={() => router.push('/privacy' as never)} />
              </Banner>
              <Banner tone="warning" icon="phone-alert" body={t('chat.emergency')} testID="chat-emergency" />
              <LocationChip compact />
              <View style={[styles.bubble, styles.assistant]}><AppText>{t('chat.welcome')}</AppText></View>
            </View>
          }
          ListFooterComponent={messages.length > 0 ? <LinkText icon="delete-outline" label={t('chat.clear')} onPress={clear} testID="chat-clear" /> : null}
          renderItem={({ item }) => {
            if (item.failed) {
              return (
                <View style={[styles.bubble, styles.assistant, styles.failed]} testID="chat-failed">
                  <AppText variant="bodySmall" color={colors.dangerDark}>{t('chat.failed')}</AppText>
                  <AppButton variant="outline" small icon="refresh" label={t('common.retry')} onPress={() => retry(item.id)} testID="chat-retry" />
                </View>
              );
            }
            const mine = item.role === 'user';
            const waiting = !mine && item.content === '';
            return (
              <View style={[styles.bubble, mine ? styles.user : styles.assistant]} testID={mine ? 'chat-user' : 'chat-assistant'}>
                {waiting
                  ? <AppText variant="bodySmall" live="polite">{t('chat.typing')}</AppText>
                  : <AppText color={mine ? colors.white : colors.text} selectable>{item.content}</AppText>}
                {!mine && !!item.mode && (
                  <View style={styles.meta}>
                    <Pill label={t(item.mode === 'ai' ? 'chat.modeAi' : 'chat.modeBasic')} icon={item.mode === 'ai' ? 'robot-outline' : 'database-search'} color={colors.navy} bg={colors.navyLight} />
                    {!!item.sources?.length && <PlaceActions sources={item.sources} />}
                    <AppText variant="caption" testID="chat-sources">{t('chat.sources')}: {item.sources?.length ? item.sources.join(' · ') : t('chat.noSources')}</AppText>
                  </View>
                )}
                {/* `mode` arrives with the finished answer, so a reply still being written, stopped or failed is not rated. */}
                {!mine && !!item.mode && <HelpfulPrompt context="chat" id={item.id} testID={`helpful-chat-${item.id}`} />}
              </View>
            );
          }}
        />
        {composer}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md },
  intro: { gap: spacing.md, marginBottom: spacing.sm },
  bubble: { maxWidth: '88%', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.xl, gap: spacing.sm },
  // Your messages in navy at the end of the row; the assistant's answers as notes set off by a
  // rule at the start, like a quotation from the record, not a second chat bubble.
  user: { alignSelf: 'flex-end', backgroundColor: colors.navy, borderBottomEndRadius: 6 },
  assistant: { alignSelf: 'flex-start', borderRadius: 0, paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, borderStartWidth: 3, borderStartColor: colors.navy },
  failed: { borderStartColor: colors.dangerDark, backgroundColor: colors.dangerLight, borderRadius: radius.sm },
  meta: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  places: { gap: spacing.sm },
  place: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  placeName: { flexBasis: '100%' },
  composer: { backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing.md, gap: spacing.sm },
  chips: { gap: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, paddingHorizontal: spacing.lg, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  send: { width: 48, height: 48, minWidth: MIN_TOUCH, borderRadius: 24, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { backgroundColor: colors.borderStrong },
  stop: { backgroundColor: colors.dangerDark },
});
