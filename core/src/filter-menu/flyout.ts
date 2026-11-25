import {
  nearestChoice,
  unitChoices,
  type RangeFilter,
  type RangeOptions,
} from "../profile-filter.js";
import { STRINGS } from "../strings.js";

const FLYOUT_ID = "snp-range-flyout";
// Keep in sync with .snp-wheel-item's height in menu.css.
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

const createSheet = (
  title: string,
  host: Element | null | undefined,
  onDone: () => void,
): { open: (...content: Node[]) => void } => {
  document.getElementById(FLYOUT_ID)?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = FLYOUT_ID;
  backdrop.className = "snp-flyout-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "snp-flyout";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", STRINGS.range.makeASelection(title));
  backdrop.appendChild(sheet);

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      close();
    }
  };
  const close = (): void => {
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
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
  const heading = document.createElement("h1");
  heading.textContent = title;
  const header = document.createElement("div");
  header.className = "snp-flyout-header";
  header.append(
    action(STRINGS.range.cancel, "left", close),
    heading,
    action(STRINGS.range.done, "right", () => {
      close();
      onDone();
    }),
  );

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      close();
    }
  });
  for (const type of ["click", "mousedown", "pointerdown", "touchstart"]) {
    backdrop.addEventListener(type, (event) => event.stopPropagation());
  }

  return {
    open: (...content) => {
      sheet.append(header, ...content);
      document.addEventListener("keydown", onKey);
      (host ?? document.body).appendChild(backdrop);
    },
  };
};

const createUnlistedOption = (
  text: string,
  checked: boolean,
  icon?: Element | null,
): { el: HTMLElement; checked: () => boolean } => {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const box = document.createElement("i");
  box.className = icon?.className ?? "fa fa-square";
  const sync = (): void => {
    box.classList.toggle("fa-check-square", input.checked);
    box.classList.toggle("fa-square", !input.checked);
    box.classList.toggle("checked", input.checked);
  };
  input.addEventListener("change", sync);
  sync();
  const el = document.createElement("label");
  el.className = "snp-flyout-option";
  el.append(input, box, text);
  return { el, checked: () => input.checked };
};

export interface ChoiceColumn {
  title: string;
  choices: WheelItem<string | null>[];
  current: string | null;
  onDone: (value: string | null) => void;
}

type RangeChoice = Pick<RangeFilter, "min" | "max" | "includeUnspecified">;

export const openRangeFlyout = (
  title: string,
  options: RangeOptions,
  current: RangeChoice,
  onDone: (next: RangeChoice) => void,
  host?: Element | null,
  checkIcon?: Element | null,
  column?: ChoiceColumn,
): void => {
  const choices: WheelItem<number>[] = unitChoices(options);
  const withNone = (top = ""): WheelItem<number | null>[] => [
    { value: null, label: STRINGS.range.openEnded },
    ...choices.map((item, i) =>
      i === choices.length - 1 ? { ...item, label: item.label + top } : item,
    ),
  ];

  // Max stays above min, min stays below max
  const push = (moved: Wheel<number | null>, other: Wheel<number | null>, step: 1 | -1): void => {
    const [from, to] = [moved.value(), other.value()];
    if (from === null || to === null || (to - from) * step > 0) {
      return;
    }
    const next = choices[choices.findIndex((choice) => choice.value === from) + step];
    other.set(next ? next.value : null);
  };
  const min: Wheel<number | null> = createWheel("min", STRINGS.range.min, () => push(min, max, 1));
  const max: Wheel<number | null> = createWheel("max", STRINGS.range.max, () => push(max, min, -1));
  const snap = (value: number | null): number | null =>
    value === null ? null : nearestChoice(choices, value).value;
  min.fill(withNone(STRINGS.range.moreSuffix), snap(current.min));
  max.fill(withNone(), snap(current.max));
  const columnWheel = column ? createWheel<string | null>("column", column.title) : null;
  columnWheel?.fill(column!.choices, column!.current);

  const unspecified = createUnlistedOption(
    STRINGS.range.includeUnlisted(title.toLowerCase()),
    current.includeUnspecified,
    checkIcon,
  );
  const to = document.createElement("span");
  to.className = "snp-wheel-middle";
  to.textContent = STRINGS.range.to;
  const body = document.createElement("div");
  body.className = "snp-wheel-container";
  body.append(...(columnWheel ? [columnWheel.el] : []), min.el, to, max.el);

  createSheet(title, host, () => {
    onDone({ min: min.value(), max: max.value(), includeUnspecified: unspecified.checked() });
    column?.onDone(columnWheel!.value());
  }).open(unspecified.el, body);
  for (const wheel of [min, max, columnWheel]) {
    wheel?.reveal();
  }
};

export const openMultiFlyout = (
  title: string,
  items: WheelItem<string>[],
  current: string[],
  unlisted: boolean,
  onDone: (values: string[], unlisted: boolean) => void,
  host?: Element | null,
  checkIcon?: Element | null,
): void => {
  const picked = new Set(current);
  const unlistedOption = createUnlistedOption(
    STRINGS.filterMenu.includeUnlisted,
    unlisted,
    checkIcon,
  );

  const prompt = document.createElement("p");
  prompt.className = "snp-flyout-prompt";
  const bold = document.createElement("span");
  bold.className = "snp-flyout-bold";
  const syncPrompt = (): void => {
    bold.textContent = items
      .filter((item) => picked.has(item.value))
      .map((item) => item.label)
      .join(", ");
    prompt.replaceChildren(`${STRINGS.range.chooseSeveral} `, bold);
  };

  const column = document.createElement("span");
  column.className = "snp-wheel-column";
  const wheel = document.createElement("div");
  wheel.className = "snp-wheel";
  wheel.dataset.wheel = "multi";
  wheel.setAttribute("role", "listbox");
  wheel.setAttribute("aria-multiselectable", "true");
  wheel.setAttribute("aria-label", title);
  column.appendChild(wheel);
  const entries: { value: string | null; label: string }[] = [
    { value: null, label: STRINGS.range.openEnded },
    ...items,
  ];
  const nodes = entries.map((entry, index) => {
    const node = document.createElement("div");
    node.className = "snp-wheel-item";
    node.setAttribute("role", "option");
    // The check mark is drawn by CSS, as Sniffies' own wheel does, in a box at the item's left.
    const check = document.createElement("span");
    check.className = "snp-wheel-check";
    check.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = entry.label;
    node.append(check, text);
    node.addEventListener("click", () => {
      if (entry.value === null) {
        picked.clear();
      } else if (picked.has(entry.value)) {
        picked.delete(entry.value);
      } else {
        picked.add(entry.value);
      }
      syncNodes();
      syncPrompt();
      wheel.scrollTop = index * ITEM_HEIGHT;
    });
    return node;
  });
  const syncNodes = (): void => {
    nodes.forEach((node, index) => {
      const value = entries[index]!.value;
      const on = value !== null && picked.has(value);
      node.classList.toggle("checked", on);
      node.setAttribute("aria-selected", String(on));
    });
  };
  wheel.append(...nodes);
  syncNodes();
  syncPrompt();

  const body = document.createElement("div");
  body.className = "snp-wheel-container";
  body.appendChild(column);

  createSheet(title, host, () =>
    onDone(
      items.filter((item) => picked.has(item.value)).map((item) => item.value),
      unlistedOption.checked(),
    ),
  ).open(prompt, unlistedOption.el, body);
};

export const openChoiceFlyout = (
  title: string,
  items: (mode: string) => WheelItem<number>[],
  current: number | null,
  onDone: (value: number, mode: string) => void,
  host?: Element | null,
  modes?: { current: string; choices: WheelItem<string>[] },
): void => {
  let mode = modes?.current ?? "";
  const wheel = createWheel<number>("choice", title);
  wheel.fill(items(mode), current ?? items(mode)[0]!.value);
  wheel.el.querySelector("p")?.remove();

  const modeRow = document.createElement("div");
  modeRow.className = "snp-flyout-modes";
  const modeButtons = (modes?.choices ?? []).map((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mode = choice.value;
    button.textContent = choice.label;
    button.addEventListener("click", () => {
      mode = choice.value;
      syncModes();
      wheel.fill(items(mode), wheel.value());
      wheel.reveal();
    });
    modeRow.appendChild(button);
    return button;
  });
  const syncModes = (): void => {
    for (const button of modeButtons) {
      const on = button.dataset.mode === mode;
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", String(on));
    }
  };
  syncModes();

  const prompt = document.createElement("p");
  prompt.className = "snp-flyout-prompt";
  prompt.textContent = STRINGS.range.selectAValue;
  const body = document.createElement("div");
  body.className = "snp-wheel-container";
  body.append(wheel.el);

  createSheet(title, host, () => onDone(wheel.value(), mode)).open(
    ...(modeButtons.length ? [modeRow] : []),
    prompt,
    body,
  );
  wheel.reveal();
};
