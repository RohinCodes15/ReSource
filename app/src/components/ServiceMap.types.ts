import type { CutService } from '../../../shared/types';

export type ServiceMapProps = {
  services: CutService[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};
