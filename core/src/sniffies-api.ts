// Everything we assume about sniffies.com API

// ── Hosts ────────────────────────────────────────────────────────────────────

export const isSniffiesApiHost = (host: string): boolean =>
  host === "sniffies.com" || host.endsWith(".sniffies.com");

/** Live presence + chat socket: wss://prod.ws.sniffies.com/?userId=<own id>&lat=...&lng=... */
export const WS_HOST = "prod.ws.sniffies.com";
/** Query param on the socket's connect URL carrying the logged-in user's own id. */
export const WS_USER_ID_PARAM = "userId";

// ── Profiles ─────────────────────────────────────────────────────────────────

export type SniffiesGender = "man" | "woman" | "nonbinary" | null;

/** A Sniffies account as it appears on the wire. `data` is absent when only the id is known. */
export interface FilterableProfile {
  _id: string;
  data?: {
    profile?: {
      extended?: {
        sexuality?: { gender?: SniffiesGender };
        /** Whole numbers, whatever units the profile was entered in. */
        stats?: { heightInCm?: number | null; weightInKg?: number | null };
      };
    };
  };
}

// What Sniffies' profile editor offers
export const HEIGHT_LIMITS = { inches: { min: 48, max: 84 }, cm: { min: 120, max: 210 } } as const;
export const WEIGHT_LIMITS = { lb: { min: 90, max: 400 }, kg: { min: 40, max: 180 } } as const;

// Imperial entries are stored as Math.round(inches * 2.54) cm and Math.round(lb / 2.20462) kg.
export const CM_PER_INCH = 2.54;
export const LB_PER_KG = 2.20462;

// ── Map + chat endpoints ─────────────────────────────────────────────────────

/** POST — the map init. */
export const POST_AUTH_PATH = "/api/post-authentication";
/** POST — "Cruise this area": reloads the map for a new spot. Same visitor lists as the map init. */
export const SOFT_RELOAD_PATH = "/api/softReload";

export interface NearbyVisitorsPayload {
  nearbyVisitors?: { visitors?: FilterableProfile[] };
  partialVisitorData?: FilterableProfile[];
  [key: string]: unknown;
}

/** GET — the chat init. */
export const CHAT_DATA_PATH = "/api/v2/post-authentication/chat-data";

export interface Conversation {
  participants?: string;
  author1?: string;
  author2?: string | null;
  [key: string]: unknown;
}

export interface ChatDataPayload {
  conversationData?: {
    conversations?: Conversation[];
    userIds?: string[];
    [key: string]: unknown;
  };
  partialVisitorData?: FilterableProfile[];
  [key: string]: unknown;
}

/** GET ?conversationId=… — an opened chat thread. */
export const MESSAGES_PATH = "/api/messages";

export interface Message {
  author?: string;
  [key: string]: unknown;
}

export interface MessagesPayload {
  messages?: Message[];
  partialUsers?: FilterableProfile[];
  [key: string]: unknown;
}

// ── Location endpoints ───────────────────────────────────────────────────────

export interface SniffiesLatLng {
  lat: number;
  lng: number;
}

/** PUT — the user's position; Travel Mode's "Travel here" sends the picked pin as virtualLocation. */
export const LOCATION_PATH = "/api/visitor/current/location";

export interface LocationPutBody {
  virtualLocation?: SniffiesLatLng;
  physicalLocation?: SniffiesLatLng;
  homeDistanceInMiles?: number | null;
  [key: string]: unknown;
}

/** GET /api/city/{id} — a Travel Mode city search result. */
export const CITY_ENDPOINT_PATTERN = /\/api\/city\/[^/?]+/;

export interface CityPayload {
  /** GeoJSON Point: [lng, lat]. */
  location?: { coordinates?: [number, number] };
  city?: string;
  admin_name?: string;
}

// ── WebSocket frames (the ones we act on) ────────────────────────────────────

/** A cruiser appeared on the map; carries their full profile. */
export interface UserJoinedFrame {
  eventName: "userJoined";
  data: FilterableProfile;
}

/** A cruiser changed something; `data.data` holds only the changed fields. */
export interface UserUpdatedFrame {
  eventName: "userUpdated";
  data: FilterableProfile;
}

/** Presence changes; `data` is the bare user id. */
export interface UserPresenceFrame {
  eventName: "userAwake" | "userDisconnected" | "userRemoved";
  data: string;
}

/** A live 1:1 chat message. */
export interface NewMsgFrame {
  eventName: "newMsg";
  data: { message?: Message };
}

/** Someone started a new chat thread with the user. */
export interface NewConversationFrame {
  eventName: "newConversation";
  data: { partialUser?: FilterableProfile };
}

export type SniffiesWsFrame =
  | UserJoinedFrame
  | UserUpdatedFrame
  | UserPresenceFrame
  | NewMsgFrame
  | NewConversationFrame;
