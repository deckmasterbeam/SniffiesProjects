export interface GeoOverride {
  enabled: boolean;
  latitude: number;
  longitude: number;
}

export const DEFAULT_GEO_OVERRIDE: GeoOverride = {
  enabled: false,
  latitude: 0,
  longitude: 0,
};
