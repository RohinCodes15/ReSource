import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from '../../../lib/i18n';
import { Page } from '../../components/Page';
import { NATIVE_DRIVER } from '../../components/ui';
import { useUserLocation } from '../../hooks/useUserLocation';
import { sendChat } from '../../lib/api';
import { cardSurface, colors, fonts, radius, SCREEN_PADDING, spacing } from '../../theme';

// `local` marks messages the app wrote itself (the greeting, connection errors). They are shown
// in the chat but never sent to the AI as conversation history.
type Message = { id: string; role: 'user' | 'assistant'; content: string; local?: boolean };

// Starter questions shown before the first message, translated under "chat" in app/locales.
const SUGGESTION_KEYS = ['chat.s1', 'chat.s2', 'chat.s3'];
const MAX_HISTORY_TURNS = 20;

// Its text comes from the translations at render time, so it follows the selected language.
const WELCOME: Message = { id: 'welcome', role: 'assistant', content: '', local: true };

/** Three dots that pulse in turn while the assistant is replying. */
function TypingDots({ label }: { label: string }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: NATIVE_DRIVER }),
          Animated.timing(dot, { toValue: 0.3, duration: 320, useNativeDriver: NATIVE_DRIVER }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);
  return (
    <View style={[styles.bubble, styles.assistant, styles.typing]} accessible accessibilityLabel={label}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0.3, 1], outputRange: [0, -4] }) }] }]}
        />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const { t, language, setLanguage, languages, isRTL } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const { location, status, request } = useUserLocation();

  // Keep the newest message in view.
  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length, loading]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;
    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', content: text };
    // Earlier turns of this chat session, so the AI remembers what was already said.
    const history = messages
      .filter((m) => !m.local)
      .map(({ role, content }) => ({ role, content }))
      .slice(-MAX_HISTORY_TURNS);
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    let reply: Message;
    try {
      const res = await sendChat({
        messages: [...history, { role: 'user', content: text }],
        language, // the backend tells the AI to answer in this language
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      reply = { id: `a${Date.now()}`, role: 'assistant', content: res.reply };
    } catch {
      reply = { id: `a${Date.now()}`, role: 'assistant', content: t('errors.network'), local: true };
    }
    setMessages((prev) => [...prev, reply]);
    setLoading(false);
  }

  const textDirection = isRTL ? styles.rtl : null;
  const canSend = !!input.trim() && !loading;

  return (
    <Page>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Language pills: the AI answers in the selected language */}
        <View style={styles.languages}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageRow}>
            {languages.map((option) => {
              const active = option.code === language;
              return (
                <Pressable
                  key={option.code}
                  onPress={() => setLanguage(option.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.label}
                  style={[styles.languagePill, active && styles.languagePillActive]}
                >
                  <Text style={styles.flag}>{option.flag}</Text>
                  <Text style={[styles.languageText, active && styles.languageTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={loading ? <TypingDots label={t('chat.typing')} /> : null}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.user : styles.assistant]}>
              <Text style={[item.role === 'user' ? styles.userText : styles.assistantText, textDirection]}>
                {item.id === 'welcome' ? t('chat.welcome') : item.content}
              </Text>
            </View>
          )}
        />

        <View style={styles.composer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={request}
              accessibilityRole="button"
              accessibilityState={{ selected: status === 'granted' }}
              style={[styles.chip, status === 'granted' && styles.chipOn]}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={14} color={status === 'granted' ? colors.successDark : colors.navy} />
              <Text style={[styles.chipText, status === 'granted' && styles.chipTextOn]}>
                {t(status === 'granted' ? 'chat.usingLocation' : 'chat.shareLocation')}
              </Text>
            </Pressable>
            {/* Suggested questions, only before the first message */}
            {messages.length === 1 &&
              SUGGESTION_KEYS.map((key) => (
                <Pressable key={key} onPress={() => send(t(key))} accessibilityRole="button" style={styles.chip}>
                  <Text style={styles.chipText}>{t(key)}</Text>
                </Pressable>
              ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, textDirection]}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.muted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send()}
              returnKeyType="send"
              accessibilityLabel={t('chat.messageLabel')}
            />
            <Pressable
              onPress={() => send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              accessibilityState={{ disabled: !canSend }}
              style={[styles.send, !canSend && styles.sendDisabled]}
            >
              <MaterialCommunityIcons name="arrow-up" size={22} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  languages: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  languageRow: { paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing.sm, gap: spacing.sm },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  languagePillActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  flag: { fontSize: 16 },
  languageText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  languageTextActive: { color: colors.white },
  list: { paddingHorizontal: SCREEN_PADDING, paddingVertical: spacing.lg, gap: spacing.md },
  bubble: { maxWidth: '82%', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.xl },
  // Messages-app style: your messages in navy on the right, the assistant in white on the left.
  user: { alignSelf: 'flex-end', backgroundColor: colors.navy, borderBottomRightRadius: 6 },
  assistant: { ...cardSurface, borderRadius: radius.xl, alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  userText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.white },
  assistantText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.text },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.lg },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
  // Right-to-left languages (Dari).
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  composer: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  chips: { paddingHorizontal: SCREEN_PADDING, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.navyLight,
  },
  chipOn: { backgroundColor: colors.successLight },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.navy },
  chipTextOn: { color: colors.successDark },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: SCREEN_PADDING },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { backgroundColor: colors.border },
});
