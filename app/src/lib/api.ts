/**
 * Typed client for the ReSource API (backend/). Every call goes through `request`, which adds
 * the install token, enforces a timeout, and flips the app into offline mode when the API
 * cannot be reached so screens fall back to the bundled data.
 */
import { Platform } from 'react-native';
import type { Alert, AlertCategory, AreaCode, Budget, ChatTurn, Council, ImpactLevel, LanguageCode, Post, Resource, Service, ServiceStatus } from '../../../shared/types';
import { adminTokenStore, authTokenStore, getInstallToken, offlineStore } from '../state/stores';

const DEFAULT_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const configured = process.env.EXPO_PUBLIC_API_URL;
// An Android emulator reaches the development computer at 10.0.2.2, not localhost.
const forAndroid = configured?.replace('://localhost', '://10.0.2.2').replace('://127.0.0.1', '://10.0.2.2');
export const API_URL = ((Platform.OS === 'android' ? forAndroid : configured) || DEFAULT_API_URL).replace(/\/$/, '');

export type FieldError = { field: string; message: string };

/** `status` 0 means the request never reached the API (offline, timeout, CORS). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, public fields: FieldError[] = [], public retryAfter?: number) {
    super(code);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

type Options = { method?: string; body?: unknown; form?: FormData; admin?: boolean; timeoutMs?: number; text?: boolean; signal?: AbortSignal };

async function headersFor(options: Options): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: options.text ? 'text/csv' : 'application/json', 'X-Client-Token': await getInstallToken() };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.admin && adminTokenStore.get()) headers['X-Admin-Token'] = adminTokenStore.get();
  if (authTokenStore.get()) headers.Authorization = `Bearer ${authTokenStore.get()}`;
  return headers;
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  options.signal?.addEventListener('abort', () => controller.abort());
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined || options.form ? 'POST' : 'GET'),
      headers: await headersFor(options),
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
  } catch {
    if (!options.signal?.aborted) offlineStore.set(true);
    throw new ApiError(0, 'network');
  } finally {
    clearTimeout(timer);
  }
  offlineStore.set(false);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: unknown; errors?: FieldError[] } | null;
    const code = typeof payload?.detail === 'string' ? payload.detail : `http_${response.status}`;
    throw new ApiError(response.status, code, payload?.errors ?? [], Number(response.headers.get('Retry-After')) || undefined);
  }
  return (options.text ? await response.text() : await response.json()) as T;
}

// ---- Public data ---------------------------------------------------------------------------

export type AppConfig = { mode: 'local' | 'supabase'; ai_enabled: boolean; email_enabled: boolean; auth_enabled: boolean; admin_enabled?: boolean; policy_version: string; data_retrieved: string };
export type Stats = { reports_total: number; reports_verified: number; posts: number; services_tracked: number; services_reduced: number; services_closed: number; resources: number };

export const getConfig = () => request<AppConfig>('/config', { timeoutMs: 5000 });
export const getStats = () => request<Stats>('/stats');
export const getServices = () => request<Service[]>('/services');
export const getResources = () => request<Resource[]>('/resources');
export const getAlerts = () => request<Alert[]>('/alerts');
export const getBudget = () => request<Budget>('/budget');
export const getCouncil = () => request<Council>('/council');
export const getPosts = (sort: 'top' | 'new') => request<Post[]>(`/posts?sort=${sort}`);

// ---- Reports and posts ---------------------------------------------------------------------

export type ConsentFlags = { consent: boolean; age_confirmed: boolean; website: string };
export type ReportInput = ConsentFlags & { service_id: string | null; service_name: string; area: AreaCode; description: string; impact_level: ImpactLevel };
export type ReportReceipt = { id: string; status: 'pending' | 'verified' | 'rejected'; created_at: string; service_name: string; area: AreaCode; impact_level: ImpactLevel; pii_removed?: string[]; has_photo?: boolean };

export const createReport = (input: ReportInput) => request<ReportReceipt>('/reports', { body: input });
export const getMyReports = () => request<ReportReceipt[]>('/reports/mine');

export async function uploadReportPhoto(reportId: string, photo: { uri: string; mimeType?: string | null }) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    form.append('photo', await (await fetch(photo.uri)).blob(), 'photo');
  } else {
    // React Native's FormData takes a file descriptor instead of a Blob.
    form.append('photo', { uri: photo.uri, name: 'photo.jpg', type: photo.mimeType ?? 'image/jpeg' } as unknown as Blob);
  }
  return request<{ id: string; has_photo: boolean }>(`/reports/${encodeURIComponent(reportId)}/photo`, { form, timeoutMs: 30000 });
}

export const createPost = (input: ConsentFlags & { body: string; area: AreaCode }) => request<Post & { pii_removed: string[] }>('/posts', { body: input });
export const votePost = (id: string) => request<{ id: string; upvotes: number; voted: boolean }>(`/posts/${encodeURIComponent(id)}/vote`, { method: 'POST' });
export const flagPost = (id: string) => request<{ id: string; flagged: boolean }>(`/posts/${encodeURIComponent(id)}/flag`, { method: 'POST' });
export const deletePost = (id: string) => request<{ id: string; deleted: boolean }>(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const sendFeedback = (kind: 'problem' | 'idea' | 'data_error', message: string) => request<{ id: string }>('/feedback', { body: { kind, message, website: '' } });

// ---- Alerts, export, deletion --------------------------------------------------------------

export type Subscription = { subscribed: boolean; categories: AlertCategory[]; areas: AreaCode[]; notifications: boolean };
export const saveSubscription = (prefs: Omit<Subscription, 'subscribed'>) => request<Subscription>('/subscriptions', { method: 'PUT', body: prefs });
export const deleteSubscription = () => request<{ subscribed: false }>('/subscriptions', { method: 'DELETE' });
export const emailSubscribe = (input: ConsentFlags & { email: string; categories: AlertCategory[]; areas: AreaCode[] }) => request<{ subscribed: boolean }>('/email/subscribe', { body: input });

export type DeletionReceipt = { receipt_id: string; completed_at: string; deleted: Record<string, number> };
export const exportMyData = () => request<Record<string, unknown>>('/me/export');
export const deleteMyData = () => request<DeletionReceipt>('/me', { method: 'DELETE' });
export const requestDeletion = (input: { contact_email: string; details: string; relationship: 'self' | 'parent_or_guardian'; consent: boolean; website: string }) =>
  request<{ receipt_id: string; received_at: string; respond_within_days: number }>('/deletion-requests', { body: input });

// ---- Admin ---------------------------------------------------------------------------------

export type AdminReport = ReportReceipt & { description: string; service_id: string | null };
export type AdminPost = Post & { flags: number };
export type Breakdown = { key: string; total: number; high: number; medium: number; low: number };
export type ImpactSummary = { verified_total: number; pending_total: number; rejected_total: number; by_impact: { key: ImpactLevel; total: number }[]; by_service: Breakdown[]; by_area: Breakdown[]; generated_at: string };
export type DeletionRequest = { id: string; contact_email: string | null; details: string; relationship: string; status: 'open' | 'completed'; created_at: string };

const admin = { admin: true } as const;
export const adminCheck = () => request<{ admin: string }>('/admin/me', admin);
export const adminReports = (status: string) => request<AdminReport[]>(`/admin/reports?status=${status}`, admin);
/** A report's photo as a data: address an <Image> can show. The route needs the admin passcode. */
export async function adminReportPhoto(id: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/admin/reports/${encodeURIComponent(id)}/photo`, { headers: { ...(await headersFor(admin)), Accept: 'image/jpeg' } });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!response.ok) throw new ApiError(response.status, `http_${response.status}`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ApiError(0, 'network'));
    reader.readAsDataURL(blob);
  });
}
export const moderateReport = (id: string, status: 'verified' | 'rejected' | 'pending') => request<AdminReport>(`/admin/reports/${encodeURIComponent(id)}`, { ...admin, body: { status } });
export const adminPosts = (status: string) => request<AdminPost[]>(`/admin/posts?status=${status}`, admin);
export const moderatePost = (id: string, status: 'approved' | 'rejected' | 'pending') => request<Post>(`/admin/posts/${encodeURIComponent(id)}`, { ...admin, body: { status } });
export const updateServiceStatus = (id: string, status: ServiceStatus) => request<Service>(`/admin/services/${encodeURIComponent(id)}`, { ...admin, body: { status } });
export const adminDeletionRequests = () => request<DeletionRequest[]>('/admin/deletion-requests', admin);
export type FeedbackRow = { id: string; kind: 'problem' | 'idea' | 'data_error'; message: string; created_at: string };
export const adminFeedback = () => request<FeedbackRow[]>('/admin/feedback', admin);
export const closeDeletionRequest = (id: string) => request<DeletionRequest>(`/admin/deletion-requests/${encodeURIComponent(id)}`, { ...admin, body: { status: 'completed' } });
export const getImpactSummary = () => request<ImpactSummary>('/impact/summary');
export const getImpactCsv = () => request<string>('/impact/export.csv', { ...admin, text: true });

// ---- Assistant -----------------------------------------------------------------------------

export type ChatPayload = { messages: ChatTurn[]; language: LanguageCode; latitude?: number; longitude?: number; area_label?: string };
export type ChatResult = { reply: string; sources: string[]; mode: 'ai' | 'basic' };
type StreamHandlers = { onText: (fullText: string) => void; signal: AbortSignal };

// The server stalled: no byte for this long ends the request instead of leaving "Writing an answer" up.
const CHAT_IDLE_MS = 20000;
// Where the reply cannot be read as a stream, nothing arrives until the whole answer is written.
const CHAT_WHOLE_MS = 60000;

/**
 * Sends a chat turn and reports the reply as it is written. The server always answers with
 * server-sent events; where the platform cannot read a response as a stream, the same response
 * is read whole and parsed, so a question is never answered twice.
 */
export async function sendChat(payload: ChatPayload, handlers: StreamHandlers): Promise<ChatResult> {
  const headers = { ...(await headersFor({ body: payload })), Accept: 'text/event-stream' };
  const controller = new AbortController();
  const stop = () => controller.abort();
  handlers.signal.addEventListener('abort', stop);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const allow = (ms: number) => { clearTimeout(timer); timer = setTimeout(stop, ms); };
  // Why the request ended early: the person pressed Stop, or the connection failed or stalled.
  const ended = () => new ApiError(0, handlers.signal.aborted ? 'aborted' : 'network');

  let buffer = '';
  let reply = '';
  let done: Pick<ChatResult, 'sources' | 'mode'> | null = null;
  const consume = (text: string) => {
    buffer += text;
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (!event || !data) continue;
      const parsed = JSON.parse(data) as { text?: string; sources?: string[]; mode?: 'ai' | 'basic' };
      if (event === 'delta') reply += parsed.text ?? '';
      if (event === 'reset') reply = parsed.text ?? ''; // the server withdrew what it had sent
      if (event === 'done') done = { sources: parsed.sources ?? [], mode: parsed.mode ?? 'ai' };
      if (event !== 'done') handlers.onText(reply);
    }
  };

  try {
    let response: Response;
    allow(CHAT_IDLE_MS);
    try {
      response = await fetch(`${API_URL}/chat/stream`, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
    } catch {
      if (!handlers.signal.aborted) offlineStore.set(true);
      throw ended();
    }
    offlineStore.set(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
      throw new ApiError(response.status, typeof body?.detail === 'string' ? body.detail : `http_${response.status}`, [], Number(response.headers.get('Retry-After')) || undefined);
    }
    try {
      const reader = response.body?.getReader?.();
      if (reader) {
        const decoder = new TextDecoder();
        for (;;) {
          allow(CHAT_IDLE_MS);
          const chunk = await reader.read();
          if (chunk.done) break;
          consume(decoder.decode(chunk.value, { stream: true }));
        }
      } else {
        allow(CHAT_WHOLE_MS);
        consume(`${await response.text()}\n\n`);
      }
    } catch {
      throw ended();
    }
    if (!done) throw ended();
    return { reply, ...(done as Pick<ChatResult, 'sources' | 'mode'>) };
  } finally {
    clearTimeout(timer);
    handlers.signal.removeEventListener('abort', stop);
  }
}
