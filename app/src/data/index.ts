import type {
  AltResource,
  CouncilMember,
  CutService,
  Post,
  ResourceCategory,
  ServiceAlert,
  ServiceCategory,
} from '../../../shared/types';
import servicesJson from '../../../shared/data/services.json';
import resourcesJson from '../../../shared/data/resources.json';
import alertsJson from '../../../shared/data/alerts.json';
import councilJson from '../../../shared/data/council.json';
import postsJson from '../../../shared/data/posts.json';

export const cutServices = servicesJson as CutService[];
export const resources = resourcesJson as AltResource[];
export const initialAlerts = alertsJson as ServiceAlert[];
export const councilMembers = councilJson as CouncilMember[];
export const initialPosts = postsJson as Post[];

export { BUDGET_MEASURE } from '../../../shared/constants';

export const SERVICE_ICONS: Record<ServiceCategory, string> = {
  library: 'book-open-variant',
  community: 'home-group',
  pool: 'pool',
  transit: 'bus',
  park: 'tree',
};

export const RESOURCE_ICONS: Record<ResourceCategory, string> = {
  Food: 'food-apple',
  Health: 'hospital-box',
  Nonprofit: 'hand-heart',
};
