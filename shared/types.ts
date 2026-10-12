// Types shared by the Expo app (and mirrored by backend/schemas.py).

export type ServiceCategory = 'library' | 'community' | 'pool' | 'transit' | 'park';

export type ServiceStatus = 'open' | 'reduced' | 'suspended' | 'closed' | 'cancelled';

export type CutService = {
  id: string;
  name: string;
  category: ServiceCategory;
  address: string;
  latitude: number;
  longitude: number;
  change: string;
  effective: string;
  details: string;
  status: ServiceStatus;
};

export type ResourceCategory = 'Food' | 'Health' | 'Nonprofit';

export type AltResource = {
  id: string;
  name: string;
  category: ResourceCategory;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  hours: string;
  description: string;
};

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type ServiceAlert = {
  id: string;
  title: string;
  body: string;
  date: string;
  area: string;
  severity: AlertSeverity;
  subscribed: boolean;
};

export type Vote = 'Yes' | 'No' | 'Abstain';

export type CouncilMember = {
  id: string;
  name: string;
  role: string;
  district: string;
  party?: string;
  vote: Vote;
  phone: string;
  email: string;
};

export type Post = {
  id: string;
  author: string;
  neighborhood: string;
  text: string;
  votes: number;
  time: string;
  upvoted: boolean;
};

export type ReportPayload = {
  service_name: string;
  location: string;
  description: string;
  impact_level?: 'low' | 'medium' | 'high';
  photo_uri?: string | null;
};

/** App languages. Matches app/locales/<code>.json and LANGUAGES in backend/routers/chat.py. */
export type LanguageCode = 'en' | 'es' | 'fa' | 'zh' | 'vi';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type ChatRequest = {
  /** The whole conversation so far, oldest first, ending with the new user message. */
  messages: ChatTurn[];
  /** The language the resident chose in the app; the AI replies in it. */
  language: LanguageCode;
  latitude?: number | null;
  longitude?: number | null;
};

export type ChatResponse = {
  reply: string;
  source: 'claude';
  language: LanguageCode;
};
