import { getHookSettings, setHookSettings, DEFAULT_HOOK_SETTINGS, type HookSettings } from "../shared/settings.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const load = async (): Promise<void> => {
  let settings: HookSettings;
  try {
    settings = await getHookSettings();
  } catch {
    settings = DEFAULT_HOOK_SETTINGS;
  }

  ($<HTMLInputElement>("captchaHook")).checked = settings.captchaHook;
  ($<HTMLInputElement>("authHook")).checked = settings.authHook;
  ($<HTMLInputElement>("wsUserIdOverride")).value = settings.wsUserIdOverride;
  ($<HTMLInputElement>("wsLatOverride")).value = settings.wsLatOverride;
  ($<HTMLInputElement>("wsLngOverride")).value = settings.wsLngOverride;
};

const save = async (): Promise<void> => {
  const settings: HookSettings = {
    captchaHook: ($<HTMLInputElement>("captchaHook")).checked,
    authHook: ($<HTMLInputElement>("authHook")).checked,
    wsUserIdOverride: ($<HTMLInputElement>("wsUserIdOverride")).value.trim(),
    wsLatOverride: ($<HTMLInputElement>("wsLatOverride")).value.trim(),
    wsLngOverride: ($<HTMLInputElement>("wsLngOverride")).value.trim(),
  };

  await setHookSettings(settings);

  const status = $("status");
  status.style.display = "block";
  setTimeout(() => { status.style.display = "none"; }, 2500);
};

$("save").addEventListener("click", () => { void save(); });

void load();
