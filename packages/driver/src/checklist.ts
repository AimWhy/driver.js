// Imported by package name, not path, so the checklist shares the one driver
// the page already loads: tours it starts replace any running tour instead of
// stacking on top, and the core is not bundled a second time.
import { driver, type Config, type DestroyReason, type DriveStep, type Driver } from "driver.js";
import "./checklist.css";

export type { DestroyReason } from "driver.js";

export type ChecklistPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export type ChecklistItemHook = (item: ChecklistItem, opts: { checklist: Checklist }) => void;

export type ChecklistItem = {
  // Stable identity for progress: saved progress is a list of these, so it
  // must survive reordering and copy edits.
  id: string;
  title: string;
  description?: string;

  // What clicking the item does. A tour ticks the item when the user finishes
  // it; a link or action ticks it on click, unless completeWhen decides.
  tour?: DriveStep[] | Config | Driver;
  href?: string;
  action?: ChecklistItemHook;

  // Checked on show(), refresh() and after the item's tour or action, for
  // tasks that are done in the app rather than in the checklist.
  completeWhen?: () => boolean;

  // Overrides the checklist's allowManualComplete for this item.
  allowManualComplete?: boolean;

  data?: Record<string, any>;
};

export type ChecklistProgress = {
  completed: string[];
  done: number;
  total: number;
};

export type ChecklistEventType =
  | "shown"
  | "hidden"
  | "opened"
  | "closed"
  | "item_started"
  | "item_completed"
  | "item_uncompleted"
  | "tour_ended"
  | "completed"
  | "reset";

export type ChecklistEvent = {
  kind: "checklist";
  id: string;
  type: ChecklistEventType;
  itemId?: string;
  reason?: DestroyReason;
  timestamp: number;
};

export type ChecklistConfig = {
  id: string;
  items: ChecklistItem[];

  title?: string;
  description?: string;
  launcherText?: string;

  // Shown instead of the texts above once every item is done, and swapped
  // back if an item is unticked.
  completeTitle?: string;
  completeDescription?: string;
  completeLauncherText?: string;

  progressText?: string;
  // The count on the launcher; an empty string hides it.
  launcherProgressText?: string;
  position?: ChecklistPosition;
  // Distance in pixels from the screen edges. (default: 20, 12 on phones)
  offset?: { x?: number; y?: number };
  className?: string;

  // Lets users tick items off, or untick them, with the check circle, for
  // tasks the checklist cannot see being done.
  allowManualComplete?: boolean;

  // Progress comes in as the ids already done and goes out through
  // onProgress, so it can live in localStorage, your API or the user record.
  completed?: string[];
  onProgress?: (progress: ChecklistProgress) => void;

  onItemComplete?: ChecklistItemHook;
  onComplete?: (opts: { checklist: Checklist }) => void;
  onEvent?: (event: ChecklistEvent) => void;
};

export interface Checklist {
  show: () => void;
  hide: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  start: (itemId: string) => void;
  complete: (itemId: string) => void;
  uncomplete: (itemId: string) => void;
  reset: () => void;
  refresh: () => void;
  getProgress: () => ChecklistProgress;
  getItems: () => ChecklistItem[];
  isVisible: () => boolean;
  isOpen: () => boolean;
}

type ChecklistDOM = {
  root: HTMLElement;
  panel: HTMLElement;
  progressText: HTMLElement;
  progressFill: HTMLElement;
  list: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  launcher: HTMLButtonElement;
  launcherText: HTMLElement;
  launcherCount: HTMLElement;
};

function isDriver(tour: ChecklistItem["tour"]): tour is Driver {
  return !!tour && typeof (tour as Driver).drive === "function";
}

function warnAboutIds(config: ChecklistConfig) {
  if (!config.id) {
    console.warn("[driver.js] Checklist is missing an id.");
  }

  const seen = new Set<string>();
  config.items.forEach(item => {
    if (!item.id) {
      console.warn(`[driver.js] Checklist item "${item.title}" is missing an id.`);
    } else if (seen.has(item.id)) {
      console.warn(`[driver.js] Duplicate checklist item id "${item.id}".`);
    }

    seen.add(item.id);
  });
}

export function checklist(config: ChecklistConfig): Checklist {
  const currentConfig: ChecklistConfig = { ...config };
  const completed = new Set<string>(config.completed || []);
  let dom: ChecklistDOM | undefined;
  let teardown: (() => void)[] = [];
  let isOpen = false;
  let hasCompleted = false;

  warnAboutIds(currentConfig);

  function items(): ChecklistItem[] {
    return currentConfig.items || [];
  }

  function find(itemId: string): ChecklistItem | undefined {
    return items().find(item => item.id === itemId);
  }

  function getProgress(): ChecklistProgress {
    return {
      // Ids of items no longer in the list are kept, so a checklist that is
      // filtered per page never drops progress made elsewhere.
      completed: Array.from(completed),
      done: items().filter(item => completed.has(item.id)).length,
      total: items().length,
    };
  }

  function isAllDone(): boolean {
    const { done, total } = getProgress();

    return total > 0 && done === total;
  }

  function emit(type: ChecklistEventType, extra: Partial<ChecklistEvent> = {}) {
    currentConfig.onEvent?.({ kind: "checklist", id: currentConfig.id, type, ...extra, timestamp: Date.now() });
  }

  function createCheck(item: ChecklistItem): HTMLElement {
    const isManual = item.allowManualComplete ?? currentConfig.allowManualComplete;
    if (!isManual) {
      const check = document.createElement("span");
      check.className = "driver-checklist-check";
      check.setAttribute("aria-hidden", "true");

      return check;
    }

    const check = document.createElement("button");
    check.type = "button";
    check.className = "driver-checklist-check";
    check.setAttribute("aria-label", `Mark "${item.title.replace(/<[^>]*>/g, "")}" as done`);
    check.addEventListener("click", () => {
      if (completed.has(item.id)) {
        uncomplete(item.id);
      } else {
        complete(item.id);
      }
    });

    return check;
  }

  function createItem(item: ChecklistItem): HTMLElement {
    const isLink = !!item.href && !item.tour && !item.action;
    const isInteractive = !!(item.tour || item.href || item.action);

    const trigger = document.createElement(isLink ? "a" : isInteractive ? "button" : "div");
    trigger.className = "driver-checklist-item-trigger";
    trigger.dataset.itemId = item.id;

    if (trigger instanceof HTMLAnchorElement) {
      trigger.href = item.href!;
    } else if (trigger instanceof HTMLButtonElement) {
      trigger.type = "button";
    }

    if (isInteractive) {
      // The link navigates on its own; this only records the click.
      trigger.addEventListener("click", event => {
        if (!isLink) {
          event.preventDefault();
        }

        startItem(item, isLink);
      });
    }

    const title = document.createElement("span");
    title.className = "driver-checklist-item-title";
    title.innerHTML = item.title;
    trigger.appendChild(title);

    if (item.description) {
      const description = document.createElement("span");
      description.className = "driver-checklist-item-description";
      description.innerHTML = item.description;
      trigger.appendChild(description);
    }

    // Filled in by render() once the item is done, for screen readers.
    const status = document.createElement("span");
    status.className = "driver-checklist-sr-only";
    trigger.appendChild(status);

    // A plain check circle is part of the row's click target, like the text.
    // On a row with nothing to start, the text ticks it like the circle does.
    const check = createCheck(item);
    if (check instanceof HTMLSpanElement && isInteractive) {
      check.addEventListener("click", () => trigger.click());
    } else if (check instanceof HTMLButtonElement && !isInteractive) {
      trigger.addEventListener("click", () => check.click());
    }

    const entry = document.createElement("li");
    entry.className = "driver-checklist-item";
    entry.appendChild(check);
    entry.appendChild(trigger);

    return entry;
  }

  function render() {
    if (!dom) {
      return;
    }

    const { done, total } = getProgress();

    // Updated in place rather than rebuilt, so focus and hover survive.
    Array.from(dom.list.children).forEach((entry, index) => {
      const isDone = completed.has(items()[index].id);
      entry.classList.toggle("driver-checklist-item-done", isDone);
      entry.querySelector(".driver-checklist-sr-only")!.textContent = isDone ? " (done)" : "";
      entry.querySelector("button.driver-checklist-check")?.setAttribute("aria-pressed", `${isDone}`);
    });

    const percent = total ? Math.round((done / total) * 100) : 0;
    const format = (text: string) =>
      text
        .replace(/{{done}}/g, `${done}`)
        .replace(/{{total}}/g, `${total}`)
        .replace(/{{remaining}}/g, `${total - done}`)
        .replace(/{{percent}}/g, `${percent}`);
    const launcherProgressText = currentConfig.launcherProgressText ?? "{{done}}/{{total}}";

    dom.progressText.textContent = format(currentConfig.progressText || "{{done}} of {{total}}");
    dom.progressFill.style.width = `${percent}%`;
    // For progress designs drawn in CSS, such as a ring around the count.
    dom.root.style.setProperty("--driver-checklist-progress", `${percent}%`);
    dom.launcherCount.textContent = format(launcherProgressText);
    dom.launcherCount.hidden = !launcherProgressText;
    dom.root.classList.toggle("driver-checklist-complete", isAllDone());

    renderTexts();
    syncLauncherTitle();
  }

  // Tracks the last string we wrote so comparison works even when the browser
  // rewrites the markup (e.g. self-closing tags, entity encoding).
  const lastHTML = new WeakMap<HTMLElement, string>();

  function setHTML(element: HTMLElement, html: string) {
    if (lastHTML.get(element) !== html) {
      lastHTML.set(element, html);
      element.innerHTML = html;
    }
  }

  function renderTexts() {
    if (!dom) {
      return;
    }

    const isComplete = isAllDone();
    const title = (isComplete && currentConfig.completeTitle) || currentConfig.title || "Get started";
    const description = (isComplete ? currentConfig.completeDescription : undefined) ?? currentConfig.description ?? "";
    const launcherText = (isComplete && currentConfig.completeLauncherText) || currentConfig.launcherText || title;

    setHTML(dom.title, title);
    setHTML(dom.description, description);
    setHTML(dom.launcherText, launcherText);

    dom.description.hidden = !description;
    dom.panel.setAttribute("aria-label", dom.title.textContent || "");
  }

  // A label too long for the launcher is cut off with an ellipsis by CSS;
  // the tooltip then shows it in full.
  function syncLauncherTitle() {
    if (!dom) {
      return;
    }

    const isTruncated = dom.launcherText.scrollWidth > dom.launcherText.clientWidth;
    if (isTruncated) {
      dom.launcher.title = dom.launcherText.textContent || "";
    } else {
      dom.launcher.removeAttribute("title");
    }
  }

  function createDOM(): ChecklistDOM {
    const root = document.createElement("div");
    root.className = `driver-checklist driver-checklist-${currentConfig.position || "bottom-right"} ${
      currentConfig.className || ""
    }`.trim();

    const { x, y } = currentConfig.offset || {};
    if (x !== undefined) {
      root.style.setProperty("--driver-checklist-offset-x", `${x}px`);
    }
    if (y !== undefined) {
      root.style.setProperty("--driver-checklist-offset-y", `${y}px`);
    }

    const panelId = `driver-checklist-${currentConfig.id}`;

    const panel = document.createElement("div");
    panel.className = "driver-checklist-panel";
    panel.id = panelId;
    panel.hidden = true;
    panel.setAttribute("role", "dialog");

    const header = document.createElement("div");
    header.className = "driver-checklist-header";

    const title = document.createElement("div");
    title.className = "driver-checklist-title";
    header.appendChild(title);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "driver-checklist-close-btn";
    closeButton.setAttribute("aria-label", "Close checklist");
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", () => {
      close();
      dom?.launcher.focus();
    });
    header.appendChild(closeButton);

    const description = document.createElement("div");
    description.className = "driver-checklist-description";
    header.appendChild(description);

    const progress = document.createElement("div");
    progress.className = "driver-checklist-progress";

    const progressText = document.createElement("div");
    progressText.className = "driver-checklist-progress-text";

    const progressBar = document.createElement("div");
    progressBar.className = "driver-checklist-progress-bar";

    const progressFill = document.createElement("div");
    progressFill.className = "driver-checklist-progress-fill";
    progressBar.appendChild(progressFill);

    progress.appendChild(progressText);
    progress.appendChild(progressBar);
    header.appendChild(progress);

    const list = document.createElement("ul");
    list.className = "driver-checklist-items";
    items().forEach(item => list.appendChild(createItem(item)));

    panel.appendChild(header);
    panel.appendChild(list);

    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "driver-checklist-launcher";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", panelId);
    launcher.addEventListener("click", () => toggle());

    const launcherText = document.createElement("span");
    launcherText.className = "driver-checklist-launcher-text";

    const launcherCount = document.createElement("span");
    launcherCount.className = "driver-checklist-launcher-count";

    launcher.appendChild(launcherText);
    launcher.appendChild(launcherCount);

    root.appendChild(panel);
    root.appendChild(launcher);

    return { root, panel, title, description, progressText, progressFill, list, launcher, launcherText, launcherCount };
  }

  function bindListeners() {
    const onKeyup = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isOpen || !dom?.root.contains(document.activeElement)) {
        return;
      }

      close();
      dom.launcher.focus();
    };

    window.addEventListener("keyup", onKeyup);
    window.addEventListener("resize", syncLauncherTitle);
    teardown = [
      () => window.removeEventListener("keyup", onKeyup),
      () => window.removeEventListener("resize", syncLauncherTitle),
    ];
  }

  function notifyProgress() {
    currentConfig.onProgress?.(getProgress());
    render();

    if (!isAllDone() || hasCompleted) {
      return;
    }

    hasCompleted = true;
    emit("completed");
    currentConfig.onComplete?.({ checklist: api });
  }

  function complete(itemId: string) {
    const item = find(itemId);
    if (!item || completed.has(itemId)) {
      return;
    }

    completed.add(itemId);
    emit("item_completed", { itemId });
    currentConfig.onItemComplete?.(item, { checklist: api });
    notifyProgress();
  }

  function uncomplete(itemId: string) {
    if (!completed.delete(itemId)) {
      return;
    }

    hasCompleted = false;
    emit("item_uncompleted", { itemId });
    currentConfig.onProgress?.(getProgress());
    render();
  }

  function refresh() {
    items().forEach(item => {
      if (!completed.has(item.id) && item.completeWhen?.()) {
        complete(item.id);
      }
    });

    render();
  }

  function onTourEnded(item: ChecklistItem, reason: DestroyReason | undefined) {
    emit("tour_ended", { itemId: item.id, reason });

    if (reason === "done" && !item.completeWhen) {
      complete(item.id);
    }

    refresh();

    // Another tour took over the screen; reopening would cover it.
    if (reason === "replaced") {
      return;
    }

    open();

    // Focus was on the tour, which is gone; hand it back to the item so
    // keyboard users continue where they left off.
    if (dom && (!document.activeElement || document.activeElement === document.body)) {
      const entry = dom.list.children[items().indexOf(item)];
      entry?.querySelector<HTMLElement>(".driver-checklist-item-trigger")?.focus();
    }
  }

  function runTour(item: ChecklistItem) {
    const tour = item.tour!;
    const instance = isDriver(tour) ? tour : driver(Array.isArray(tour) ? { steps: tour } : tour);

    // Listen for the end of the tour without taking the hook away from the
    // instance's owner, and hand their config back once it is over.
    const ownConfig = instance.getConfig();
    instance.setConfig({
      ...ownConfig,
      onDestroyed: (element, step, opts) => {
        instance.setConfig(ownConfig);
        ownConfig.onDestroyed?.(element, step, opts);
        onTourEnded(item, opts.reason);
      },
    });

    close();
    instance.drive();
  }

  function startItem(item: ChecklistItem, isLinkClick = false) {
    emit("item_started", { itemId: item.id });

    if (item.tour) {
      runTour(item);
      return;
    }

    item.action?.(item, { checklist: api });

    if (item.completeWhen) {
      refresh();
    } else if (item.action || item.href) {
      complete(item.id);
    }

    if (item.href && !isLinkClick) {
      window.location.assign(item.href);
    }
  }

  function start(itemId: string) {
    const item = find(itemId);
    if (item) {
      startItem(item);
    }
  }

  function open() {
    if (!dom || isOpen) {
      return;
    }

    isOpen = true;
    dom.panel.hidden = false;
    dom.launcher.setAttribute("aria-expanded", "true");
    emit("opened");
  }

  function close() {
    if (!dom || !isOpen) {
      return;
    }

    isOpen = false;
    dom.panel.hidden = true;
    dom.launcher.setAttribute("aria-expanded", "false");
    emit("closed");
  }

  function toggle() {
    if (isOpen) {
      close();
      return;
    }

    open();
  }

  function show() {
    if (dom) {
      return;
    }

    dom = createDOM();
    document.body.appendChild(dom.root);
    bindListeners();

    // Progress passed in may already cover every item; that is not a fresh
    // completion, so onComplete stays quiet.
    hasCompleted = isAllDone();

    render();
    refresh();
    emit("shown");
  }

  function hide() {
    if (!dom) {
      return;
    }

    close();
    teardown.forEach(off => off());
    teardown = [];

    dom.root.remove();
    dom = undefined;
    emit("hidden");
  }

  function reset() {
    completed.clear();
    hasCompleted = false;
    emit("reset");
    currentConfig.onProgress?.(getProgress());
    render();
  }

  const api: Checklist = {
    show,
    hide,
    open,
    close,
    toggle,
    start,
    complete,
    uncomplete,
    reset,
    refresh,
    getProgress,
    getItems: items,
    isVisible: () => !!dom,
    isOpen: () => isOpen,
  };

  return api;
}
