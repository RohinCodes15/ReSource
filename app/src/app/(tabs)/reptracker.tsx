import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CouncilMember, CouncilVote } from '../../../../shared/types';
import { Screen } from '../../components/Page';
import { Sheet } from '../../components/Sheet';
import { AppButton, AppText, Banner, Card, ErrorState, Field, LinkText, LoadingList, Pill, SourceLine } from '../../components/ui';
import { bundledCouncil } from '../../data';
import { useApi } from '../../hooks/useData';
import { getCouncil } from '../../lib/api';
import { formatDate, useTranslation } from '../../lib/i18n';
import { copyText, mailtoUrl, telUrl } from '../../lib/platform';
import { colors, spacing } from '../../theme';

const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2);

/** Editable letter to one council member. It is sent from the person's own email app, never by ReSource. */
function LetterSheet({ member, onClose }: { member: CouncilMember | null; onClose: () => void }) {
  const { t } = useTranslation();
  const title = member ? t(`reps.role_${member.role}`) : '';
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fill in the draft, in the selected language, each time a different member is opened.
  if (member && loadedFor !== member.id) {
    setLoadedFor(member.id);
    setSubject(t('reps.letterSubject'));
    setBody(t('reps.letterBody', { title, name: member.name }));
    setCopied(false);
  }

  return (
    <Sheet visible={!!member} onClose={onClose} title={member ? t('reps.writeTo', { name: member.name }) : ''} testID="letter-sheet">
      {member && (
        <>
          <AppText variant="bodySmall" color={colors.text}>{t('reps.letterHelp')}</AppText>
          <Field label={t('reps.subjectLabel')} value={subject} onChangeText={setSubject} maxLength={150} testID="letter-subject" />
          <Field label={t('reps.bodyLabel')} value={body} onChangeText={setBody} multiline maxLength={3000} testID="letter-body" />
          <AppButton variant="gold" icon="email-fast" label={t('reps.openEmail')} href={mailtoUrl(member.email, subject, body)} testID="letter-email" />
          <AppButton variant="outline" icon="content-copy" label={t(copied ? 'reps.copied' : 'reps.copyLetter')} onPress={async () => setCopied(await copyText(`${subject}\n\n${body}`))} testID="letter-copy" />
          {copied && <AppText variant="caption" live="polite">{t('reps.copiedHelp', { email: member.email })}</AppText>}
          <AppText variant="caption">{t('reps.letterPrivacy')}</AppText>
        </>
      )}
    </Sheet>
  );
}

function VoteCard({ vote }: { vote: CouncilVote }) {
  const { t, tx, locale } = useTranslation();
  return (
    <Card style={styles.block} testID={`vote-${vote.id}`}>
      <AppText variant="caption">{formatDate(vote.date, locale)}</AppText>
      <AppText variant="h4" heading={3}>{vote.title}</AppText>
      <Pill label={tx('outcome', vote.outcome)} icon="gavel" color={colors.navy} bg={colors.navyLight} />
      <AppText variant="bodySmall" color={colors.text}>{vote.summary}</AppText>
      <Banner tone={vote.tally === 'unverified' ? 'warning' : 'info'} icon="help-circle-outline" title={t(vote.tally === 'unverified' ? 'reps.voteUnverified' : 'reps.voteReported')} body={t(vote.tally === 'unverified' ? 'reps.voteUnverifiedBody' : 'reps.voteReportedBody')} testID="vote-record" />
      <SourceLine title={vote.source_title} url={vote.source_url} retrieved={vote.retrieved} />
      <LinkText icon="open-in-new" label={t('reps.minutes')} href={vote.minutes_url} />
    </Card>
  );
}

/** Rep Tracker: who represents Fremont, how to reach them, and what the Council did on the budget. */
export default function RepsScreen() {
  const { t, locale } = useTranslation();
  const { data, loading, error, reload } = useApi(getCouncil, () => bundledCouncil);
  const [writing, setWriting] = useState<CouncilMember | null>(null);

  if (loading) return <Screen title={t('titles.reps')}><LoadingList /></Screen>;
  if (error || !data) return <Screen title={t('titles.reps')}><ErrorState onRetry={reload} /></Screen>;

  return (
    <Screen title={t('titles.reps')} testID="reps-screen">
      <AppText variant="bodySmall" color={colors.text}>{t('reps.intro')}</AppText>
      <Banner tone="info" icon="map-search" title={t('reps.findDistrict')} body={t('reps.findDistrictBody')}>
        <LinkText icon="open-in-new" label={t('reps.districtLocator')} href={data.district_locator_url} testID="district-locator" />
      </Banner>
      <Banner tone="info" icon="vote" title={t('reps.electionTitle', { date: formatDate(data.election.date, locale) })} body={t('reps.electionBody', { seats: data.election.seats.join(', ') })}>
        <LinkText icon="open-in-new" label={data.election.source_title} href={data.election.source_url} />
      </Banner>

      <AppText variant="h3" heading={2}>{t('reps.members')}</AppText>
      {data.members.map((member) => (
        <Card key={member.id} style={styles.block} testID={`member-${member.id}`}>
          <View style={styles.head}>
            <View style={styles.avatar} aria-hidden><AppText variant="h4" color={colors.white}>{initials(member.name)}</AppText></View>
            <View style={styles.flex}>
              <AppText variant="h4" heading={3}>{member.name}</AppText>
              <AppText variant="bodySmall" color={colors.text}>
                {t(`reps.role_${member.role}`)} · {member.district ? t('reps.district', { number: member.district }) : t('reps.citywide')}
              </AppText>
              <AppText variant="caption">{t('reps.termEnds', { date: member.term_ends })}</AppText>
            </View>
          </View>
          <View style={styles.actions}>
            <AppButton variant="navy" icon="pencil" label={t('reps.write')} accessibilityLabel={t('reps.writeTo', { name: member.name })} onPress={() => setWriting(member)} style={styles.action} testID={`write-${member.id}`} />
            <AppButton variant="outline" icon="phone" label={member.phone} accessibilityLabel={t('common.callNumber', { phone: member.phone })} href={telUrl(member.phone)} style={styles.action} testID={`call-${member.id}`} />
            <AppButton variant="outline" icon="email" label={member.email} accessibilityLabel={`${t('common.email')}: ${member.email}`} href={`mailto:${member.email}`} style={styles.action} testID={`email-${member.id}`} />
          </View>
        </Card>
      ))}
      <SourceLine title={data.source_title} url={data.source_url} retrieved={data.retrieved} />
      <AppText variant="bodySmall">{t('reps.clerk', { phone: data.clerk.phone, email: data.clerk.email })}</AppText>

      <AppText variant="h3" heading={2}>{t('reps.votesTitle')}</AppText>
      <AppText variant="bodySmall" color={colors.text}>{t('reps.votesIntro')}</AppText>
      {data.votes.map((vote) => <VoteCard key={vote.id} vote={vote} />)}
      <LetterSheet member={writing} onClose={() => setWriting(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 220 },
});
