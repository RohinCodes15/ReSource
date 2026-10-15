import type { Service } from '../../../shared/types';
import type { LatLng } from '../utils/geo';

/** A service that has a position, plus the point where its pin is drawn. */
export type MapPin = {
  service: Service;
  latitude: number;
  longitude: number;
  label: string;
  /** Pixels to draw the pin away from its true point, so pins at one address do not stack (phones; the web groups them instead). */
  dx: number;
  dy: number;
};

export type ServiceMapProps = {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Where the map is centered when it opens and when "recenter" is pressed. */
  center: LatLng;
  /** Shown as a "you are here" dot when the person has shared a location. */
  you: LatLng | null;
  /** Change this number to make the map return to `center`. */
  recenterKey: number;
  labels: {
    map: string; you: string; zoomIn: string; zoomOut: string;
    /** Spoken name of a group of pins (web): how many, and which. */
    cluster: (count: number, names: string) => string;
    /** Shown over the map when the map images cannot be loaded (web). */
    tilesFailed: string;
  };
};
