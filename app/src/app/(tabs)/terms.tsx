import { LegalDocument } from '../../components/Legal';
import { ACCOUNT_TERMS, TERMS } from '../../legal/content';
import { useAccountRequired } from '../../lib/supabase';

export default function TermsScreen() {
  const accountRequired = useAccountRequired();
  return <LegalDocument titleKey="titles.terms" summaryKey="legal.termsSummary" sections={accountRequired ? ACCOUNT_TERMS : TERMS} testID="terms-screen" />;
}
