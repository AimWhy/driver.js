import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { destroyDriverClick, onDriverClick } from "../src/click";

// Covers the capture-phase click primitive directly; popover and overlay
// button behaviour on top of it lives in interactions.test.ts.

let host: HTMLElement;
let inner: HTMLButtonElement;
let outside: HTMLButtonElement;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="host"><button id="inner">Inner</button></div>
    <button id="outside">Outside</button>
  `;
  host = document.getElementById("host")!;
  inner = document.getElementById("inner") as HTMLButtonElement;
  outside = document.getElementById("outside") as HTMLButtonElement;
});

afterEach(() => {
  destroyDriverClick(host);
  document.body.innerHTML = "";
});

function fire(target: Element, type = "click"): boolean {
  return target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
}

describe("onDriverClick", () => {
  it("runs the listener when a click lands inside the element", () => {
    const listener = vi.fn();
    onDriverClick(host, listener);

    fire(inner);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks outside the element", () => {
    const listener = vi.fn();
    onDriverClick(host, listener);

    fire(outside);

    expect(listener).not.toHaveBeenCalled();
  });

  it("only runs the listener for the click event, not the preceding pointer events", () => {
    const listener = vi.fn();
    onDriverClick(host, listener);

    fire(inner, "pointerdown");
    fire(inner, "mousedown");
    fire(inner, "pointerup");
    fire(inner, "mouseup");

    expect(listener).not.toHaveBeenCalled();

    fire(inner, "click");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("prevents the default action on intercepted events", () => {
    onDriverClick(host, vi.fn());

    expect(fire(inner)).toBe(false);
  });

  it("stops the event before any other document listener sees it", () => {
    const bystander = vi.fn();
    document.addEventListener("click", bystander);
    onDriverClick(host, vi.fn());

    fire(inner);

    document.removeEventListener("click", bystander);
    expect(bystander).not.toHaveBeenCalled();
  });

  it("lets the default action through when shouldPreventDefault returns false", () => {
    const listener = vi.fn();
    onDriverClick(host, listener, () => false);

    expect(fire(inner)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("replaces the previous handler when attached again to the same element", () => {
    const first = vi.fn();
    const second = vi.fn();
    onDriverClick(host, first);
    onDriverClick(host, second);

    fire(inner);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("destroyDriverClick", () => {
  it("detaches the handler so clicks reach the page again", () => {
    const listener = vi.fn();
    const bystander = vi.fn();
    onDriverClick(host, listener);
    destroyDriverClick(host);

    document.addEventListener("click", bystander);
    fire(inner);
    document.removeEventListener("click", bystander);

    expect(listener).not.toHaveBeenCalled();
    expect(bystander).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for an element that was never attached", () => {
    expect(() => destroyDriverClick(outside)).not.toThrow();
  });
});
