/**
 * The data bundled with the app. It is the same JSON the API serves in local mode, so when the
 * API cannot be reached every screen still has real, sourced content to show (offline mode).
 */
import alertsJson from '../../../shared/data/alerts.json';
import budgetJson from '../../../shared/data/budget.json';
import councilJson from '../../../shared/data/council.json';
import postsJson from '../../../shared/data/posts.json';
import resourcesJson from '../../../shared/data/resources.json';
import servicesJson from '../../../shared/data/services.json';
import votesJson from '../../../shared/data/votes.json';
import zipsJson from '../../../shared/data/zips.json';
import type { Alert, Budget, Council, CouncilVote, Post, Resource, Service, ZipTable } from '../../../shared/types';
import type { IconName } from '../components/ui';

export const bundledServices = servicesJson as Service[];
export const bundledResources = resourcesJson as Resource[];
export const bundledAlerts = (alertsJson as Alert[]).slice().sort((a, b) => b.published_at.localeCompare(a.published_at));
export const bundledPosts = postsJson as Post[];
export const bundledBudget = budgetJson as unknown as Budget;
export const bundledCouncil = { ...councilJson, votes: votesJson as CouncilVote[] } as Council;
export const zipTable = zipsJson as ZipTable;

export const FREMONT_CENTER = { latitude: zipTable.center.lat, longitude: zipTable.center.lng };

/** Icons for the category values found in the data. Labels are translated: `category.<key>`. */
export const SERVICE_ICONS: Record<string, IconName> = {
  infrastructure: 'road-variant',
  parks: 'tree',
  public_safety: 'shield-account',
  administration: 'office-building',
  human_services: 'hand-heart',
  seniors: 'human-cane',
  youth: 'account-child',
};

export const RESOURCE_ICONS: Record<string, IconName> = {
  Food: 'food-apple',
  Health: 'hospital-box',
  Housing: 'home-city',
  Seniors: 'human-cane',
  Legal: 'scale-balance',
  Library: 'book-open-variant',
  Referral: 'phone-in-talk',
  Community: 'account-group',
  Crisis: 'lifebuoy',
};

export const ALERT_ICONS: Record<string, IconName> = {
  budget: 'cash-multiple',
  public_safety: 'shield-account',
  human_services: 'hand-heart',
  infrastructure: 'road-variant',
  civic: 'vote',
};
