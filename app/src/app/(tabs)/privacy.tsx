import { LegalDocument } from '../../components/Legal';
import { ACCOUNT_PRIVACY, PRIVACY } from '../../legal/content';
import { accountRequired } from '../../lib/supabase';

export default function PrivacyScreen() {
  return <LegalDocument titleKey="titles.privacy" summaryKey={accountRequired ? 'legal.privacySummaryAccount' : 'legal.privacySummary'} sections={accountRequired ? ACCOUNT_PRIVACY : PRIVACY} testID="privacy-screen" />;
}
