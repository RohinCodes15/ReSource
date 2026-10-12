import { LegalDocument } from '../../components/Legal';
import { PRIVACY } from '../../legal/content';

export default function PrivacyScreen() {
  return <LegalDocument titleKey="titles.privacy" summaryKey="legal.privacySummary" sections={PRIVACY} testID="privacy-screen" />;
}
