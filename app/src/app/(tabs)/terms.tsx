import { LegalDocument } from '../../components/Legal';
import { TERMS } from '../../legal/content';

export default function TermsScreen() {
  return <LegalDocument titleKey="titles.terms" summaryKey="legal.termsSummary" sections={TERMS} testID="terms-screen" />;
}
