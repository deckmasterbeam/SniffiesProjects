const form = document.getElementById("options-form");
const enabledInput = document.getElementById("enabled");
const saveStatus = document.getElementById("save-status");

const load = async (): Promise<void> => {
  const { enabled = true } = await chrome.storage.sync.get(["enabled"]);
  if (enabledInput instanceof HTMLInputElement) {
    enabledInput.checked = Boolean(enabled);
  }
};

const save = async (event: SubmitEvent): Promise<void> => {
  event.preventDefault();
  const enabled = enabledInput instanceof HTMLInputElement ? enabledInput.checked : true;
  await chrome.storage.sync.set({ enabled });
  if (saveStatus) {
    saveStatus.textContent = "Saved.";
    setTimeout(() => {
      saveStatus.textContent = "";
    }, 1500);
  }
};

form?.addEventListener("submit", (event) => {
  void save(event as SubmitEvent);
});
void load();
