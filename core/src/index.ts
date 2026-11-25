export { countDistinctBlockedBotsLast24h, recordBlockedBotIds } from "@core/blocked-bot-log.js";
export type { BlockedBotDailyLog } from "@core/blocked-bot-log.js";
export { BOT_BLOCK_CSS, BOT_BLOCK_HTML, wireBotBlockForm } from "@core/bot-block-ui.js";
export {
  extractCitySearchResult,
  installCitySearchXhrObserver,
  isCitySearchUrl,
} from "@core/city-search-hook.js";
export type { CitySearchResult } from "@core/city-search-hook.js";
export { installCitySearchStatusUI } from "@core/city-search-status-hook.js";
export type { CitySearchStatusHandle } from "@core/city-search-status-hook.js";
export type * from "@core/contracts.js";
export { installProfileFiltersMenu } from "@core/filter-menu/menu.js";
export { installGeoHook } from "@core/geo-hook.js";
export type { GeoHookResult } from "@core/geo-hook.js";
export { installHidePhotoClick } from "@core/hide-photo-click-hook.js";
export { installHidePhotoMenuButtons } from "@core/hide-photo-menu-hook.js";
export {
  getHasPlus,
  getPremiumFeatureFlags,
  getPremiumFeaturesEnabled,
  getPremiumSectionOpen,
  getProfileBorderOpen,
  getProfileFiltersEnabled,
  getProfileFiltersSectionOpen,
  setHasPlus,
  setPremiumFeatureFlags,
  setPremiumFeaturesEnabled,
  setPremiumSectionOpen,
  setProfileBorderOpen,
  setProfileFiltersEnabled,
  setProfileFiltersSectionOpen,
} from "@core/local-storage.js";
export { installLocationOverrideController } from "@core/location-override-controller.js";
export type { LocationOverrideController } from "@core/location-override-controller.js";
export { logInit } from "@core/log-init.js";
export { createLogger } from "@core/log.js";
export type { Logger } from "@core/log.js";
export { mountFab } from "@core/mount-fab.js";
export { watchOwnIdInDom } from "@core/own-id-dom.js";
export { installOwnIdHook } from "@core/own-id-hook.js";
export { default as PANEL_CSS } from "@core/panel.css";
export { installPlusHook, isPlusMembership } from "@core/plus-hook.js";
export {
  PREMIUM_FEATURES_CSS,
  PREMIUM_FEATURES_HTML,
  wirePremiumFeaturesForm,
} from "@core/premium-features-ui.js";
export type { PremiumFeaturesFormHandle } from "@core/premium-features-ui.js";
export { installProfileBorderRedirect } from "@core/profile-border-hook.js";
export type { ProfileBorderHookResult } from "@core/profile-border-hook.js";
export {
  filterChatDataPayload,
  filterMessagesPayload,
  filterPostAuthenticationPayload,
  installProfileFilterHook,
  shouldFilterWebSocketFrame,
} from "@core/profile-filter-hook.js";
export type { ProfileFilterHookResult } from "@core/profile-filter-hook.js";
export {
  DEFAULT_GENDER_FILTER,
  DEFAULT_ONLINE_FILTER,
  DEFAULT_PROFILE_FILTERS,
  GENDERS,
  allowedGenders,
  botBlockRule,
  createProfileMatcher,
  gateProfileFilters,
  genderRule,
  loadFiltersMirror,
  onlineRule,
  parseGenderFilter,
  parseProfileFilters,
  profileFilterRules,
  profileGender,
  rangeRule,
  saveFiltersMirror,
  statTakeover,
} from "@core/profile-filter.js";
export type {
  Gender,
  GenderFilter,
  OnlineFilter,
  ProfileFilterRule,
  ProfileFilters,
  ProfileMatcher,
  RangeFilter,
} from "@core/profile-filter.js";
export {
  PROFILE_FILTERS_CSS,
  PROFILE_FILTERS_HTML,
  wireProfileFiltersForm,
} from "@core/profile-filters-ui.js";
export { findSeenMessageId, installReadReceipt } from "@core/read-receipt-hook.js";
export {
  installReportButtonInjection,
  refreshBlockedBotsIfStale,
} from "@core/report-button-hook.js";
export { REPORT_MODAL_CSS, REPORT_MODAL_HTML, wireReportModal } from "@core/report-ui.js";
export type { ReportModalHandle } from "@core/report-ui.js";
export { installSelectionLimitOverride } from "@core/selection-limit-hook.js";
export { installSentPhotoHider } from "@core/sent-photos.js";
export type { SentPhotoHider, ThreadSnapshot } from "@core/sent-photos.js";
export {
  DEFAULT_GEO_OVERRIDE,
  DEFAULT_LOCAL_SETTINGS,
  DEFAULT_PREMIUM_FEATURE_FLAGS,
  DEFAULT_PROFILE_BORDER_OPEN,
  PHONE_E164_REGEX,
  SETTINGS_KEYS,
  SNIFFIES_USER_ID_REGEX,
  hasCapturedCoords,
  parsePremiumFeatureFlags,
} from "@core/settings.js";
export type {
  ExtensionLocalSettings,
  GeoOverride,
  PremiumFeatureFlags,
  ProfileBorderOpen,
} from "@core/settings.js";
export * from "@core/sniffies-api.js";
export {
  APP_SCREEN_SELECTOR,
  CHAT_MESSAGE_CONTAINER_SELECTOR,
  CITIES_INPUT_SELECTOR,
  CONNECTED_NOW_FILTER_LABEL_SELECTOR,
  ENDOWMENT_FILTER_LABEL_SELECTOR,
  HIDE_ALL_PHOTOS_BUTTON_SELECTOR,
  HIDE_PHOTO_BUTTON_SELECTOR,
  ICON_HOLDER_RIGHT_BOTTOM_SELECTOR,
  MARKER_AVATAR_SELECTOR,
  MARKER_CONTAINER_SELECTOR,
  NAME_LABEL_SELECTOR,
  PHOTO_MESSAGE_SELECTOR,
  PIN_BUTTON_SELECTOR,
  PROFILE_TYPE_FILTER_LABEL_SELECTOR,
  SNIFFIES_SELECTORS,
  TRAVEL_HERE_BUTTON_SELECTOR,
  UNHIDE_ALL_PHOTOS_BUTTON_SELECTOR,
} from "@core/sniffies-selectors.js";
export type { SniffiesSelectorName } from "@core/sniffies-selectors.js";
export { STRINGS } from "@core/strings.js";
export { extractTravelDestination, installTravelClickArmer } from "@core/travel-capture-hook.js";
export type { TravelClickArmer } from "@core/travel-capture-hook.js";
export { UPDATE_BANNER_CSS, UPDATE_BANNER_HTML, wireUpdateBanner } from "@core/update-banner.js";
export { fetchLatestVersion, isNewerVersion, isUpdateAvailable } from "@core/update-check.js";
export type { ReleaseChannel } from "@core/update-check.js";
export { installUserIdHook } from "@core/user-id-hook.js";
export { VERSION_BADGE_CSS, VERSION_BADGE_HTML, wireVersionBadge } from "@core/version-badge.js";
