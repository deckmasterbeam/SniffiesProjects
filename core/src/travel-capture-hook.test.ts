import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractTravelDestination, installTravelClickArmer } from "./travel-capture-hook.js";

const click = (el: Element) => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("installTravelClickArmer", () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    button = document.createElement("button");
    button.setAttribute("data-testid", "travelHereButton");
    document.body.appendChild(button);
  });

  afterEach(() => {
    document.body.removeChild(button);
    vi.useRealTimers();
  });

  it("consume() is false before any click", () => {
    const armer = installTravelClickArmer();
    expect(armer.consume()).toBe(false);
  });

  it("consume() is true right after a travel-here click", () => {
    const armer = installTravelClickArmer();
    click(button);
    expect(armer.consume()).toBe(true);
  });

  it("consume() resets the armed state — a second call is false", () => {
    const armer = installTravelClickArmer();
    click(button);
    armer.consume();
    expect(armer.consume()).toBe(false);
  });

  it("ignores clicks on unrelated elements", () => {
    const other = document.createElement("button");
    document.body.appendChild(other);
    const armer = installTravelClickArmer();
    click(other);
    expect(armer.consume()).toBe(false);
    document.body.removeChild(other);
  });

  it("arms from a click on a descendant of the button (e.g. its icon)", () => {
    const icon = document.createElement("i");
    button.appendChild(icon);
    const armer = installTravelClickArmer();
    click(icon);
    expect(armer.consume()).toBe(true);
  });

  it("disarms automatically after the timeout elapses", () => {
    const armer = installTravelClickArmer();
    click(button);
    vi.advanceTimersByTime(5001);
    expect(armer.consume()).toBe(false);
  });

  it("fires onClick synchronously on a matching click", () => {
    const onClick = vi.fn();
    installTravelClickArmer(onClick);
    click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire onClick for unrelated clicks", () => {
    const onClick = vi.fn();
    const other = document.createElement("button");
    document.body.appendChild(other);
    installTravelClickArmer(onClick);
    click(other);
    expect(onClick).not.toHaveBeenCalled();
    document.body.removeChild(other);
  });
});

describe("extractTravelDestination", () => {
  it("extracts lat/lng from a virtualLocation body", () => {
    expect(extractTravelDestination({ virtualLocation: { lat: 47.6, lng: -122.3 } })).toEqual({
      latitude: 47.6,
      longitude: -122.3,
    });
  });

  it("returns null when virtualLocation is missing", () => {
    expect(extractTravelDestination({ homeDistanceInMiles: null })).toBeNull();
  });

  it("returns null for non-numeric lat/lng", () => {
    expect(extractTravelDestination({ virtualLocation: { lat: "47.6", lng: -122.3 } })).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(extractTravelDestination(null)).toBeNull();
    expect(extractTravelDestination("string")).toBeNull();
    expect(extractTravelDestination(undefined)).toBeNull();
  });
});
