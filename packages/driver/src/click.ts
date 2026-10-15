const DRIVER_CLICK_EVENTS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;

const driverClickHandlers = new WeakMap<Element, (e: MouseEvent | PointerEvent) => void>();

/**
 * Attaches click handler to the elements created by driver.js. It makes
 * sure to give the listener the first chance to handle the event, and
 * prevents all other pointer-events to make sure no external-library
 * ever knows the click happened.
 */
export function onDriverClick(
  element: Element,
  listener: (pointer: MouseEvent | PointerEvent) => void,
  shouldPreventDefault?: (target: HTMLElement) => boolean
) {
  destroyDriverClick(element);

  const handler = (e: MouseEvent | PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!element.contains(target)) {
      return;
    }

    if (!shouldPreventDefault || shouldPreventDefault(target)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    if (e.type === "click") {
      listener?.(e);
    }
  };

  // We want to be the absolute first one to hear about the event
  const useCapture = true;

  for (const type of DRIVER_CLICK_EVENTS) {
    document.addEventListener(type, handler, useCapture);
  }

  driverClickHandlers.set(element, handler);
}

export function destroyDriverClick(element: Element) {
  const handler = driverClickHandlers.get(element);
  if (!handler) {
    return;
  }

  for (const type of DRIVER_CLICK_EVENTS) {
    document.removeEventListener(type, handler, true);
  }

  driverClickHandlers.delete(element);
}
