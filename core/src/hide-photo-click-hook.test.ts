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

const setup = (hideOne = vi.fn().mockResolvedValue(null), reload = vi.fn()) => {
  document.body.innerHTML = PHOTO_HTML;
  uninstall = installHidePhotoClick({ hideOne }, reload);
  const label = document.querySelector<HTMLElement>(".message-tooltip-copy span")!;
  return { hideOne, label, reload };
};

afterEach(() => {
  uninstall?.();
  document.body.innerHTML = "";
});

describe("installHidePhotoClick", () => {
  it("hides the clicked photo's message and swallows the click before Sniffies' handler", () => {
    const { hideOne, label } = setup();
    const sniffiesHandler = vi.fn();
    document.querySelector(".message-tooltip")!.addEventListener("click", sniffiesHandler);

    label.click();

    expect(hideOne).toHaveBeenCalledWith("6acb586864db18a454d53d42");
    expect(sniffiesHandler).not.toHaveBeenCalled();
  });

  it("reloads the page once the photo is hidden", async () => {
    const { label, reload } = setup();
    label.click();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
  });

  it("doesn't reload when the request fails", async () => {
    const hideOne = vi.fn().mockResolvedValue("nope");
    const { label, reload } = setup(hideOne);
    label.click();
    await vi.waitFor(() => expect(hideOne).toHaveBeenCalled());
    expect(reload).not.toHaveBeenCalled();
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
});
