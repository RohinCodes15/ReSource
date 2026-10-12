import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import type { CouncilMember, Vote } from '../../../../shared/types';
import { Page } from '../../components/Page';
import { AppButton, Pill } from '../../components/ui';
import { BUDGET_MEASURE, councilMembers } from '../../data';
import { cardSurface, colors, fonts, radius, SCREEN_PADDING, spacing, type } from '../../theme';

// The measure is a package of service cuts, so a YES vote is shown in red and a NO vote in green.
const VOTE_STYLE: Record<Vote, { label: string; color: string; bg: string }> = {
  Yes: { label: 'Voted YES', color: colors.dangerDark, bg: colors.dangerLight },
  No: { label: 'Voted NO', color: colors.successDark, bg: colors.successLight },
  Abstain: { label: 'Abstained', color: colors.muted, bg: colors.border },
};

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

export default function RepsScreen() {
  const [contact, setContact] = useState<CouncilMember | null>(null);
  const tally = councilMembers.reduce(
    (acc, m) => ({ ...acc, [m.vote]: acc[m.vote] + 1 }),
    { Yes: 0, No: 0, Abstain: 0 } as Record<Vote, number>,
  );

  return (
    <Page>
      <FlatList
        data={councilMembers}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <LinearGradient colors={[colors.navy, colors.navyDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary}>
            <Text style={styles.summaryLabel}>Budget vote</Text>
            <Text style={styles.summaryTitle}>{BUDGET_MEASURE}</Text>
            <View style={styles.tally}>
              {(['Yes', 'No', 'Abstain'] as const).map((vote) => (
                <View key={vote} style={styles.tallyItem}>
                  <Text style={styles.tallyNumber}>{tally[vote]}</Text>
                  <Text style={styles.tallyLabel}>{vote}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.disclaimer}>
              Sample vote data for the demo only; not an official roll call. Fremont city council seats are nonpartisan.
            </Text>
          </LinearGradient>
        }
        renderItem={({ item }) => {
          const v = VOTE_STYLE[item.vote];
          return (
            <View style={styles.card}>
              <LinearGradient colors={[colors.navy, '#2C5AA0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardHeader}>
                <Pill label={item.district} color={colors.navyDark} bg={colors.gold} style={styles.district} />
              </LinearGradient>
              <View style={styles.cardBody}>
                <View style={styles.avatar} accessibilityLabel="Photo placeholder">
                  <Text style={styles.avatarText}>{initials(item.name)}</Text>
                </View>
                <View style={styles.identity}>
                  <Text style={type.h4}>{item.name}</Text>
                  <Text style={type.bodySmall}>{item.role} · {item.party ?? 'Nonpartisan'}</Text>
                </View>
                <View style={styles.footer}>
                  <View style={styles.voteWrap}>
                    <Pill label={v.label} color={v.color} bg={v.bg} />
                    <Text style={type.caption}>Sample data</Text>
                  </View>
                  <AppButton
                    variant="outline"
                    icon="message-text-outline"
                    label="Contact"
                    accessibilityLabel={`Contact ${item.name}`}
                    onPress={() => setContact(item)}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />
      <Portal>
        <Dialog visible={!!contact} onDismiss={() => setContact(null)} style={styles.dialog}>
          <Dialog.Title>Contact {contact?.name}</Dialog.Title>
          <Dialog.Content>
            <Text style={type.body}>{contact?.role}, {contact?.district}</Text>
            <Text style={[type.bodySmall, styles.hint]}>Tip: say your neighborhood and which service matters to you.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setContact(null)}>Close</Button>
            <Button
              icon="email"
              onPress={() => contact && Linking.openURL(`mailto:${contact.email}?subject=Fremont%20budget%20and%20city%20services`)}
            >
              Email
            </Button>
            <Button icon="phone" onPress={() => contact && Linking.openURL(`tel:${contact.phone.replace(/\D/g, '')}`)}>
              {contact?.phone}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Page>
  );
}

const styles = StyleSheet.create({
  list: { padding: SCREEN_PADDING, gap: spacing.lg, paddingBottom: spacing.xxxl },
  summary: { borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.sm },
  summaryLabel: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.gold },
  summaryTitle: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: colors.white },
  tally: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  tallyItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  tallyNumber: { fontFamily: fonts.bold, fontSize: 24, color: colors.white },
  tallyLabel: { fontFamily: fonts.medium, fontSize: 12, color: '#C9D6EA' },
  disclaimer: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: '#C9D6EA', marginTop: spacing.xs },
  card: { ...cardSurface, overflow: 'hidden' },
  cardHeader: { height: 64, alignItems: 'flex-end', padding: spacing.md },
  district: { alignSelf: 'flex-end' },
  cardBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  // The avatar overlaps the gradient header.
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: -32,
    backgroundColor: colors.navy,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, color: colors.white },
  identity: { gap: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md },
  voteWrap: { gap: spacing.xs },
  dialog: { borderRadius: radius.xl, backgroundColor: colors.surface },
  hint: { marginTop: spacing.sm },
});
