import { type ProfileFilterRule } from "@core/profile-filter/matcher.js";
import { type FilterableProfile, type SniffiesGender } from "@core/sniffies-api.js";

export const GENDERS = ["man", "woman", "nonbinary", "undefined"] as const;
export type Gender = (typeof GENDERS)[number];

export interface GenderFilter {
  enabled: boolean;
  genders: Gender[];
}

export const DEFAULT_GENDER_FILTER: GenderFilter = { enabled: false, genders: [...GENDERS] };

export const parseGenderFilter = (value: unknown): GenderFilter => {
  const raw = (value ?? {}) as { enabled?: unknown; genders?: unknown };
  const { genders } = raw;
  const picked = Array.isArray(genders) ? GENDERS.filter((g) => genders.includes(g)) : [];
  return { enabled: raw.enabled === true, genders: picked.length > 0 ? picked : [...GENDERS] };
};

export const allowedGenders = (filter: GenderFilter): readonly Gender[] =>
  filter.enabled ? filter.genders : GENDERS;

const WIRE_GENDERS: Partial<Record<Exclude<SniffiesGender, null>, Gender>> = {
  man: "man",
  woman: "woman",
  nonbinary: "nonbinary",
};

export const profileGender = (profile: FilterableProfile): Gender | null => {
  if (!profile.data) {
    return null;
  }
  const raw = profile.data.profile?.extended?.sexuality?.gender;
  return (raw && WIRE_GENDERS[raw]) || "undefined";
};

export const genderRule = (getFilter: () => GenderFilter): ProfileFilterRule => ({
  name: "gender",
  mapOnly: true,
  isActive: () => {
    const { enabled, genders } = getFilter();
    return enabled && genders.length > 0 && genders.length < GENDERS.length;
  },
  hides: (profile) => {
    const gender = profileGender(profile);
    return gender !== null && !getFilter().genders.includes(gender);
  },
});
