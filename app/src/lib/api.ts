import { Platform } from 'react-native';
import type { ChatRequest, ChatResponse, ReportPayload } from '../../../shared/types';

const DEFAULT_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
const androidHostUrl = configuredApiUrl?.replace('://localhost', '://10.0.2.2').replace('://127.0.0.1', '://10.0.2.2');
export const API_URL = ((Platform.OS === 'android' ? androidHostUrl : configuredApiUrl) || DEFAULT_API_URL).replace(/\/$/, '');

export type ServiceStatus = 'open' | 'reduced' | 'closed';
export type ApiService = {
  id: string;
  name: string;
  category: 'library' | 'transit' | 'recreation' | 'health' | 'education';
  status: ServiceStatus;
  address: string;
  lat: number;
  lng: number;
  description: string;
  cut_amount: number;
  effective_date: string | null;
  created_at: string;
};

export type ApiResource = {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  lat: number;
  lng: number;
  description: string;
  languages: string[];
  distance_miles: number;
};

export type ApiStats = {
  reports: number;
  resources: number;
  services_affected: number;
};

export type ApiReportReceipt = {
  id: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
};

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(body?.detail || `API request failed (${response.status})`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchServices = () => requestJson<ApiService[]>('/services');
export const fetchService = (id: string) => requestJson<ApiService>(`/services/${encodeURIComponent(id)}`);

export function fetchResources(lat?: number | null, lng?: number | null) {
  const query = lat != null && lng != null ? `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}` : '';
  return requestJson<ApiResource[]>(`/resources${query}`);
}

export function submitReport(payload: ReportPayload) {
  return requestJson<ApiReportReceipt>('/report', {
    method: 'POST',
    body: JSON.stringify({
      service_name: payload.service_name,
      address: payload.location,
      description: payload.description,
      impact_level: payload.impact_level ?? 'medium',
    }),
  });
}

export const sendChat = (request: ChatRequest) =>
  requestJson<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify(request) }, 30000);

export const fetchStats = () => requestJson<ApiStats>('/stats');
