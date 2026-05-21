export interface GeoOverride {
  enabled: boolean;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const DEFAULT_GEO_OVERRIDE: GeoOverride = {
  enabled: false,
  latitude: 0,
  longitude: 0,
  accuracy: 10,
};

export const randomAccuracy = (): number => Math.round((5 + Math.random() * 20) * 10) / 10;
