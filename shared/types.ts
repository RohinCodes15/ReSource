// Types shared by the Expo app. They mirror shared/data/*.json and backend/database/schema.sql.

export type ServiceStatus = 'open' | 'reduced' | 'closed';
export type AreaCode = 'citywide' | '94536' | '94538' | '94539' | '94555';
export type ImpactLevel = 'low' | 'medium' | 'high';
export type AlertCategory = 'budget' | 'public_safety' | 'human_services' | 'infrastructure' | 'civic';
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** App languages. Matches app/src/locales/<code>.json and LANGUAGE_NAMES in backend/grounding.py. */
export type LanguageCode = 'en' | 'es' | 'fa' | 'zh' | 'vi';

export type Service = {
  id: string;
  name: string;
  category: string;
  status: ServiceStatus;
  area: AreaCode;
  address: string;
  location_note: string | null;
  lat: number | null;
  lng: number | null;
  /** "approximate" until scraper/geocode.py has run for the row. */
  coords: string | null;
  phone: string | null;
  hours: string | null;
  summary: string;
  detail: string | null;
  before?: string;
  after?: string;
  cut_amount: number | null;
  cut_amount_note: string | null;
  effective_date: string | null;
  updated_at: string | null;
  action_label: string | null;
  action_url: string | null;
  /** Resource categories to offer when someone taps "Find Alternative". */
  alt_categories: string[];
  source_title: string | null;
  source_url: string | null;
  retrieved: string | null;
  verified: boolean;
};

export type Resource = {
  id: string;
  name: string;
  category: string;
  area: AreaCode;
  address: string;
  lat: number | null;
  lng: number | null;
  coords: string | null;
  phone: string;
  website: string;
  hours: string | null;
  description: string;
  languages: string[];
  language_note: string | null;
  source_url: string | null;
  retrieved: string | null;
  verified: boolean;
};

export type Alert = {
  id: string;
  title: string;
  body: string;
  category: AlertCategory;
  area: AreaCode;
  severity: AlertSeverity;
  published_at: string;
  service_id: string | null;
  source_title: string | null;
  source_url: string | null;
  retrieved: string | null;
  verified: boolean;
};

export type Post = {
  id: string;
  body: string;
  area: AreaCode;
  created_at: string;
  upvotes: number;
  status: 'approved' | 'pending' | 'rejected';
  is_sample: boolean;
  mine?: boolean;
  voted?: boolean;
};

export type CouncilMember = {
  id: string;
  name: string;
  role: 'mayor' | 'vice_mayor' | 'councilmember';
  district: number | null;
  phone: string;
  email: string;
  term_ends: string;
};

export type CouncilVote = {
  id: string;
  date: string;
  title: string;
  summary: string;
  outcome: string;
  /** "unverified" until someone checks the official minutes. */
  tally: 'unverified' | 'reported_unanimous';
  tally_note: string | null;
  member_votes: Record<string, string>;
  source_title: string;
  source_url: string;
  minutes_url: string;
  retrieved: string;
};

export type Council = {
  source_title: string;
  source_url: string;
  retrieved: string;
  district_locator_url: string;
  clerk: { name: string; phone: string; email: string };
  meetings_url: string;
  election: { date: string; seats: string[]; source_title: string; source_url: string };
  members: CouncilMember[];
  votes: CouncilVote[];
};

export type BudgetSource = { title: string; publisher: string; url: string };
export type BudgetTable = { caption: string; source: string; page: number; columns: string[]; rows: { label: string; values: number[] }[]; note?: string };

export type Budget = {
  retrieved: string;
  sources: Record<string, BudgetSource>;
  headline: { id: string; label: string; amount: number; source: string; page: number | null }[];
  reductions: { id: string; label: string; detail: string; amount: number; fiscal_year: string; source: string; page: number | null; lastUpdated?: string; changeNote?: string }[];
  positions: { id: string; label: string; count: number; source: string }[];
  general_fund_shares: { caption: string; note: string; source: string; page: number; items: { label: string; percent: number }[] };
  revenue: BudgetTable;
  staffing: BudgetTable;
  reserves: { caption: string; source: string; page: number; items: { label: string; amount: number; note: string }[] };
  context: { id: string; text: string; source: string; page: number | null }[];
  timeline: { date: string; title: string; text: string; source: string }[];
};

export type ZipEntry = { zip: string; area: AreaCode; label: string; lat: number; lng: number; kind: 'standard' | 'po_box' };
export type ZipTable = {
  source_title: string;
  source_url: string;
  retrieved: string;
  note: string;
  center: { label: string; lat: number; lng: number };
  zips: ZipEntry[];
};

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
