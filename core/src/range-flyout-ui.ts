import { nearestChoice, type RangeFilter, type RangeOptions } from "./profile-filter.js";

const FLYOUT_ID = "snp-range-flyout";
// Keep in sync with .snp-wheel-item's height in filter-menu.css.
const ITEM_HEIGHT = 34;

interface WheelItem<T> {
  value: T;
  label: string;
}

interface Wheel<T> {
  el: HTMLElement;
  value: () => T;
  /** Replaces the items, selecting the one holding `value` (or the first). */
  fill: (items: WheelItem<T>[], value: T) => void;
  /** Moves the selection to the item holding `value`, if there is one. */
  set: (value: T) => void;
  /** Scrolls the selected item into the middle — only works once the wheel is in the page. */
  reveal: () => void;
}

const createWheel = <T>(name: string, title: string, onChange?: () => void): Wheel<T> => {
  const el = document.createElement("span");
  el.className = "snp-wheel-column";
  const heading = document.createElement("p");
  heading.textContent = title;
  const list = document.createElement("div");
  list.className = "snp-wheel";
  list.dataset.wheel = name;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", title);
  el.append(heading, list);

  let items: WheelItem<T>[] = [];
  let index = 0;

  const select = (next: number): void => {
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    const moved = clamped !== index;
    index = clamped;
    [...list.children].forEach((node, i) => {
      node.classList.toggle("selected", i === index);
      node.setAttribute("aria-selected", String(i === index));
    });
    if (moved) {
      onChange?.();
    }
  };
  const reveal = (): void => {
    list.scrollTop = index * ITEM_HEIGHT;
  };
  list.addEventListener("scroll", () => select(Math.round(list.scrollTop / ITEM_HEIGHT)));

  return {
    el,
    value: () => items[index]!.value,
    fill: (nextItems, value) => {
      items = nextItems;
      list.replaceChildren(
        ...items.map((item, i) => {
          const node = document.createElement("div");
          node.className = "snp-wheel-item";
          node.setAttribute("role", "option");
          node.textContent = item.label;
          node.addEventListener("click", () => {
            select(i);
            reveal();
          });
          return node;
        }),
      );
      index = Math.max(
        0,
        items.findIndex((item) => item.value === value),
      );
      select(index);
      reveal();
    },
    set: (value) => {
      const next = items.findIndex((item) => item.value === value);
      if (next !== -1 && next !== index) {
        select(next);
        reveal();
      }
    },
    reveal,
  };
};

type RangeChoice = Pick<RangeFilter, "min" | "max" | "metric">;

export const openRangeFlyout = (
  title: string,
  options: RangeOptions,
  current: RangeChoice,
  onDone: (next: RangeChoice) => void,
  host?: Element | null,
): void => {
  document.getElementById(FLYOUT_ID)?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = FLYOUT_ID;
  backdrop.className = "snp-flyout-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "snp-flyout";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", `${title}: Make a Selection`);
  backdrop.appendChild(sheet);

  const close = (): void => {
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      close();
    }
  };

  const action = (text: string, side: string, onClick: () => void): HTMLElement => {
    const wrap = document.createElement("span");
    wrap.className = `snp-flyout-action ${side}`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", onClick);
    wrap.appendChild(button);
    return wrap;
  };

  const choices = (metric: boolean): WheelItem<number>[] =>
    (metric ? options.metric : options.imperial).choices;
  // "-" leaves that end of the range open, as on Sniffies' own wheels.
  const withNone = (items: WheelItem<number>[], top = ""): WheelItem<number | null>[] => [
    { value: null, label: "-" },
    ...items.map((item, i) =>
      i === items.length - 1 ? { ...item, label: item.label + top } : item,
    ),
  ];

  // Max stays above min, min stays below max
  const push = (moved: Wheel<number | null>, other: Wheel<number | null>, step: 1 | -1): void => {
    const [from, to] = [moved.value(), other.value()];
    if (from === null || to === null || (to - from) * step > 0) {
      return;
    }
    const list = choices(unit.value());
    const next = list[list.findIndex((choice) => choice.value === from) + step];
    other.set(next ? next.value : null);
  };
  const min: Wheel<number | null> = createWheel("min", "Min", () => push(min, max, 1));
  const max: Wheel<number | null> = createWheel("max", "Max", () => push(max, min, -1));
  const fillBounds = (metric: boolean, minValue: number | null, maxValue: number | null): void => {
    const list = choices(metric);
    const snap = (value: number | null): number | null =>
      value === null ? null : nearestChoice(list, value).value;
    min.fill(withNone(list, " +"), snap(minValue));
    max.fill(withNone(list), snap(maxValue));
  };
  const unit: Wheel<boolean> = createWheel("unit", "Unit", () =>
    fillBounds(unit.value(), min.value(), max.value()),
  );
  unit.fill(
    [
      { value: false, label: options.imperial.unit },
      { value: true, label: options.metric.unit },
    ],
    current.metric,
  );
  fillBounds(current.metric, current.min, current.max);

  const heading = document.createElement("h1");
  heading.textContent = title;
  const header = document.createElement("div");
  header.className = "snp-flyout-header";
  header.append(
    action("Cancel", "left", close),
    heading,
    action("Done", "right", () => {
      close();
      onDone({ min: min.value(), max: max.value(), metric: unit.value() });
    }),
  );

  const to = document.createElement("span");
  to.className = "snp-wheel-middle";
  to.textContent = "to";
  const body = document.createElement("div");
  body.className = "snp-wheel-container";
  body.append(unit.el, min.el, to, max.el);
  sheet.append(header, body);

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      close();
    }
  });
  for (const type of ["click", "mousedown", "pointerdown", "touchstart"]) {
    backdrop.addEventListener(type, (event) => event.stopPropagation());
  }
  document.addEventListener("keydown", onKey);

  (host ?? document.body).appendChild(backdrop);
  for (const wheel of [unit, min, max]) {
    wheel.reveal();
  }
};
