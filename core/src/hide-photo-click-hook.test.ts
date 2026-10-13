// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installHidePhotoClick } from "./hide-photo-click-hook.js";

// Trimmed from a real Sniffies sent-photo bubble with the Hide Photo tooltip open.
const PHOTO_HTML = `
  <div class="focused-message multi-photo-item">
    <chat-photo-message>
      <div class="image-container chat-photo-message photo sent_message" id="message-6acb586864db18a454d53d42">
        <figure class="chat-image"><img src="https://chat.sniffiesassets.com/x-chat-pic.jpeg"></figure>
      </div>
      <div class="reactions-tooltip-container">
        <chat-message-hide-tooltip>
          <div tabindex="0" role="button" class="message-tooltip" aria-label="Hide Photo">
            <div class="message-tooltip-copy"><span> Hide Photo </span></div>
          </div>
        </chat-message-hide-tooltip>
      </div>
    </chat-photo-message>
  </div>`;

let uninstall: (() => void) | null = null;

let enabled = true;

const setup = (hideOne = vi.fn().mockResolvedValue(null), reload = vi.fn(), onError = vi.fn()) => {
  const setAllHidden = vi.fn().mockResolvedValue(null);
  document.body.innerHTML = PHOTO_HTML;
  uninstall = installHidePhotoClick({ hideOne, setAllHidden }, () => enabled, reload, onError);
  const label = document.querySelector<HTMLElement>(".message-tooltip-copy span")!;
  return { hideOne, setAllHidden, label, reload, onError };
};

afterEach(() => {
  enabled = true;
  uninstall?.();
  document.body.innerHTML = "";
});

describe("installHidePhotoClick", () => {
  it("hides the clicked photo's message and swallows the click before Sniffies' handler", () => {
    const { hideOne, label } = setup();
    const sniffiesHandler = vi.fn();
    document.querySelector(".message-tooltip")!.addEventListener("click", sniffiesHandler);

    label.click();

    expect(hideOne).toHaveBeenCalledWith("6acb586864db18a454d53d42", null);
    expect(sniffiesHandler).not.toHaveBeenCalled();
  });

  it("reloads the page once the photo is hidden", async () => {
    const { label, reload } = setup();
    label.click();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
  });

  it("reports the error instead of reloading when the request fails", async () => {
    const hideOne = vi.fn().mockResolvedValue("nope");
    const { label, reload, onError } = setup(hideOne);
    label.click();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("nope"));
    expect(reload).not.toHaveBeenCalled();
  });

  it("lets the click through when the feature is disabled", () => {
    const { hideOne, label } = setup();
    enabled = false;
    const sniffiesHandler = vi.fn();
    document.querySelector(".message-tooltip")!.addEventListener("click", sniffiesHandler);

    label.click();

    expect(hideOne).not.toHaveBeenCalled();
    expect(sniffiesHandler).toHaveBeenCalled();
  });

  it("ignores clicks that aren't on a Hide Photo button", () => {
    const { hideOne } = setup();
    document.querySelector<HTMLElement>("img")!.click();
    expect(hideOne).not.toHaveBeenCalled();
  });

  it("lets a click through when the photo has no resolvable message id", () => {
    const { hideOne, label } = setup();
    document.querySelector(".image-container")!.removeAttribute("id");
    const sniffiesHandler = vi.fn();
    document.querySelector(".message-tooltip")!.addEventListener("click", sniffiesHandler);

    label.click();

    expect(hideOne).not.toHaveBeenCalled();
    expect(sniffiesHandler).toHaveBeenCalled();
  });

  describe("profile menu buttons", () => {
    const PROFILE_ID = "694abfeb1cf11f4a71d32027";
    const MENU_HTML = `
      <div data-testid="profileOptionsContainer">
        <button data-testid="hideAllPhotosButton"><span>Hide All My Photos</span></button>
        <button data-testid="unhideAllPhotosButton"><span>Unhide All My Photos</span></button>
      </div>`;

    const openMenu = (path: string) => {
      history.pushState({}, "", path);
      const result = setup();
      document.body.insertAdjacentHTML("beforeend", MENU_HTML);
      return result;
    };

    afterEach(() => history.pushState({}, "", "/"));

    it("hides all photos for the open profile", async () => {
      const { setAllHidden, reload } = openMenu(`/profile/${PROFILE_ID}/chat`);
      document.querySelector<HTMLElement>('[data-testid="hideAllPhotosButton"] span')!.click();
      expect(setAllHidden).toHaveBeenCalledWith(PROFILE_ID, true);
      await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    });

    it("unhides all photos for the open profile", () => {
      const { setAllHidden } = openMenu(`/profile/${PROFILE_ID}`);
      document.querySelector<HTMLElement>('[data-testid="unhideAllPhotosButton"] span')!.click();
      expect(setAllHidden).toHaveBeenCalledWith(PROFILE_ID, false);
    });

    it("lets the click through when no profile is open", () => {
      const { setAllHidden } = openMenu("/");
      const sniffiesHandler = vi.fn();
      const button = document.querySelector<HTMLElement>('[data-testid="hideAllPhotosButton"]')!;
      button.addEventListener("click", sniffiesHandler);

      button.click();

      expect(setAllHidden).not.toHaveBeenCalled();
      expect(sniffiesHandler).toHaveBeenCalled();
    });
  });
});
