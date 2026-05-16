declare const __SAVE_NUMBER_ENDPOINT__: string;
declare const __SERVER_BASE__: string;
declare const __CLIENT_SECRET__: string;

import { PHONE_E164_REGEX, SETTINGS_KEYS, getLocalSettings } from "../shared/settings.js";

const clientHeaders = (extra?: Record<string, string>): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${__CLIENT_SECRET__}`,
  ...extra,
});

// ── Phone ─────────────────────────────────────────────────────────────────────

const phoneInput = document.getElementById("phone-input");
const phoneSaveBtn = document.getElementById("phone-save");
const phoneStatus = document.getElementById("phone-status");

const setPhoneStatus = (text: string): void => {
  if (phoneStatus) phoneStatus.textContent = text;
};

phoneSaveBtn?.addEventListener("click", async () => {
  const phone = phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : "";
  if (!PHONE_E164_REGEX.test(phone)) {
    setPhoneStatus("Must be E.164 format, e.g. +15551234567");
    if (phoneInput instanceof HTMLInputElement) {
      phoneInput.classList.add("invalid");
      phoneInput.focus();
    }
    return;
  }
  if (phoneInput instanceof HTMLInputElement) phoneInput.classList.remove("invalid");
  if (phoneSaveBtn instanceof HTMLButtonElement) phoneSaveBtn.disabled = true;
  setPhoneStatus("Saving…");
  try {
    const res = await fetch(__SAVE_NUMBER_ENDPOINT__, {
      method: "POST",
      headers: clientHeaders(),
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setPhoneStatus(`Error: ${body.error ?? res.status}`);
      return;
    }
    const data = (await res.json()) as { ok: boolean; guid?: string };
    await chrome.storage.local.set({ [SETTINGS_KEYS.phone]: phone });
    if (data.guid) {
      await chrome.storage.local.set({ [SETTINGS_KEYS.guid]: data.guid });
      void loadFavorites(data.guid);
    }
    setPhoneStatus("Saved.");
  } catch (err) {
    setPhoneStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (phoneSaveBtn instanceof HTMLButtonElement) phoneSaveBtn.disabled = false;
  }
});

if (phoneInput instanceof HTMLInputElement) {
  phoneInput.addEventListener("input", () => phoneInput.classList.remove("invalid"));
}

// ── Recovery ──────────────────────────────────────────────────────────────────

const sendGuidBtn = document.getElementById("send-guid-btn");
const recoveryStatus = document.getElementById("recovery-status");
const codeInput = document.getElementById("code-input");
const codeSaveBtn = document.getElementById("code-save");

const setRecoveryStatus = (text: string): void => {
  if (recoveryStatus) recoveryStatus.textContent = text;
};

sendGuidBtn?.addEventListener("click", async () => {
  const phone = phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : "";
  if (!PHONE_E164_REGEX.test(phone)) {
    setRecoveryStatus("Enter your phone number above first.");
    return;
  }
  if (sendGuidBtn instanceof HTMLButtonElement) sendGuidBtn.disabled = true;
  setRecoveryStatus("Sending…");
  try {
    const res = await fetch(`${__SERVER_BASE__}/api/send-guid`, {
      method: "POST",
      headers: clientHeaders(),
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setRecoveryStatus(`Error: ${body.error ?? res.status}`);
      return;
    }
    setRecoveryStatus("Code sent! Check your messages.");
  } catch (err) {
    setRecoveryStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (sendGuidBtn instanceof HTMLButtonElement) sendGuidBtn.disabled = false;
  }
});

codeSaveBtn?.addEventListener("click", async () => {
  const code = codeInput instanceof HTMLInputElement ? codeInput.value.trim() : "";
  if (!code) {
    setRecoveryStatus("Paste your code first.");
    return;
  }
  await chrome.storage.local.set({ [SETTINGS_KEYS.guid]: code });
  setRecoveryStatus("Code saved.");
  void loadFavorites(code);
});

// ── Favorites ─────────────────────────────────────────────────────────────────

const grid = document.getElementById("grid");
const summary = document.getElementById("summary");
const template = document.getElementById("card-template");

interface ApiFavoriteEntry {
  user_id: string;
  profile_pic_url: string | null;
  favorited_at: string;
}

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return "";
  }
};

const renderCard = (entry: ApiFavoriteEntry, guid: string): HTMLElement => {
  if (!(template instanceof HTMLTemplateElement)) {
    throw new Error("card template missing");
  }
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const card = fragment.querySelector(".card") as HTMLElement;

  const image = card.querySelector<HTMLElement>('[data-role="image"]');
  if (image) {
    if (entry.profile_pic_url) {
      image.style.backgroundImage = `url(${JSON.stringify(entry.profile_pic_url)})`;
    } else {
      image.classList.add("empty");
    }
  }

  const idEl = card.querySelector<HTMLElement>('[data-role="user-id"]');
  if (idEl) idEl.textContent = entry.user_id;

  const dateEl = card.querySelector<HTMLElement>('[data-role="favorited-at"]');
  if (dateEl) dateEl.textContent = `Favorited ${formatDate(entry.favorited_at)}`;

  const unfavoriteBtn = card.querySelector<HTMLButtonElement>('[data-role="unfavorite"]');
  if (unfavoriteBtn) {
    unfavoriteBtn.addEventListener("click", () => {
      void fetch(`${__SERVER_BASE__}/api/favorites`, {
        method: "POST",
        headers: clientHeaders(),
        body: JSON.stringify({ guid, userId: entry.user_id, favorite: false }),
      }).then(() => loadFavorites(guid));
    });
  }

  return card;
};

const render = (entries: ApiFavoriteEntry[], guid: string): void => {
  if (!grid) return;
  grid.replaceChildren();

  if (summary) {
    summary.textContent =
      entries.length === 0
        ? "No favorites yet."
        : `${entries.length} favorite${entries.length === 1 ? "" : "s"}`;
  }

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Click the star next to a cruiser's name on sniffies.com to add them here.";
    grid.append(empty);
    return;
  }

  for (const entry of entries) {
    grid.append(renderCard(entry, guid));
  }
};

const loadFavorites = async (guid: string): Promise<void> => {
  if (summary) summary.textContent = "Loading...";
  try {
    const res = await fetch(`${__SERVER_BASE__}/api/favorites?guid=${encodeURIComponent(guid)}`, {
      headers: clientHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { ok: boolean; favorites: ApiFavoriteEntry[] };
    render(data.favorites ?? [], guid);
  } catch (err) {
    if (summary) summary.textContent = "Couldn't load favorites.";
    if (grid) {
      grid.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      grid.append(empty);
    }
  }
};

void getLocalSettings().then(({ phone, guid }) => {
  if (phoneInput instanceof HTMLInputElement) phoneInput.value = phone;
  if (guid) {
    void loadFavorites(guid);
  } else {
    if (summary) summary.textContent = "Save your phone number to load favorites.";
    if (grid) grid.replaceChildren();
  }
});
