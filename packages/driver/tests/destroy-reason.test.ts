import { describe, expect, it, vi } from "vitest";
import type { DestroyReason, DriveStep } from "../src/driver";
import { createDriver, navButton, nextFrame, pressKey, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

function clickOverlay(): void {
  document.querySelector(".driver-overlay path")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function clickElement(selector: string): void {
  document.querySelector(selector)?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

// The reason the most recent onDestroyed call received.
function lastReason(onDestroyed: ReturnType<typeof vi.fn>): DestroyReason | undefined {
  return onDestroyed.mock.calls.at(-1)?.[2].reason;
}

const ONE_STEP: DriveStep[] = [{ element: "#intro", popover: { title: "Only" } }];

describe("destroy reason", () => {
  it("is 'done' when the done button finishes the tour", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    d.drive();
    await nextFrame();

    navButton("next")?.click();
    navButton("next")?.click();
    navButton("next")?.click();

    expect(d.isActive()).toBe(false);
    expect(lastReason(onDestroyed)).toBe("done");
  });

  it("is 'done' when the right arrow moves past the last step", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: ONE_STEP, onDestroyed });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");

    expect(lastReason(onDestroyed)).toBe("done");
  });

  it("is 'done' when advanceOnClick moves past the last step", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, advanceOnClick: true, steps: ONE_STEP, onDestroyed });
    d.drive();
    await nextFrame();

    clickElement("#intro");

    expect(lastReason(onDestroyed)).toBe("done");
  });

  it("is 'done' when moveNext() is called on the last step", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: ONE_STEP, onDestroyed });
    d.drive();
    await nextFrame();

    d.moveNext();

    expect(lastReason(onDestroyed)).toBe("done");
  });

  it("is 'done' when the remaining steps are skipped as missing", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: [...ONE_STEP, { element: "#missing", popover: { title: "Gone" } }],
      onDestroyed,
    });
    d.drive();
    await nextFrame();

    navButton("next")?.click();

    expect(lastReason(onDestroyed)).toBe("done");
  });

  it("is 'close' when the close button is clicked", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    d.drive();
    await nextFrame();

    navButton("close")?.click();

    expect(lastReason(onDestroyed)).toBe("close");
  });

  it("is 'escape' when the escape key closes the tour", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    d.drive();
    await nextFrame();

    pressKey("Escape");

    expect(lastReason(onDestroyed)).toBe("escape");
  });

  it("is 'overlay' when an overlay click closes the tour", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    d.drive();
    await nextFrame();

    clickOverlay();

    expect(lastReason(onDestroyed)).toBe("overlay");
  });

  it("is 'api' when destroy() is called directly", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    d.drive();
    await nextFrame();

    d.destroy();

    expect(lastReason(onDestroyed)).toBe("api");
  });

  it("is 'api' when moveTo() is given an index outside the steps", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    d.drive();
    await nextFrame();

    d.moveTo(10);

    expect(lastReason(onDestroyed)).toBe("api");
  });

  it("is 'replaced' when another instance takes over", async () => {
    const onDestroyed = vi.fn();
    const first = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    first.drive();
    await nextFrame();

    createDriver({ animate: false, steps: ONE_STEP }).drive();

    expect(lastReason(onDestroyed)).toBe("replaced");
  });

  it("is passed to onDestroyStarted and kept when the hook calls destroy()", async () => {
    const onDestroyed = vi.fn();
    const onDestroyStarted = vi.fn((_el, _step, { driver }) => driver.destroy());
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyStarted, onDestroyed });
    d.drive();
    await nextFrame();

    navButton("close")?.click();

    expect(onDestroyStarted.mock.calls[0][2].reason).toBe("close");
    expect(lastReason(onDestroyed)).toBe("close");
  });

  it("keeps 'close' when an onCloseClick hook calls destroy()", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({
      animate: false,
      steps: SAMPLE_STEPS,
      onCloseClick: (_el, _step, { driver }) => driver.destroy(),
      onDestroyed,
    });
    d.drive();
    await nextFrame();

    navButton("close")?.click();

    expect(lastReason(onDestroyed)).toBe("close");
  });

  it("keeps 'done' when an onNextClick hook on the last step calls destroy()", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({
      animate: false,
      steps: ONE_STEP,
      onNextClick: (_el, _step, { driver }) => driver.destroy(),
      onDestroyed,
    });
    d.drive();
    await nextFrame();

    navButton("next")?.click();

    expect(lastReason(onDestroyed)).toBe("done");
  });

  it("keeps 'overlay' when an overlayClickBehavior function calls destroy()", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({
      animate: false,
      steps: SAMPLE_STEPS,
      overlayClickBehavior: (_el, _step, { driver }) => driver.destroy(),
      onDestroyed,
    });
    d.drive();
    await nextFrame();

    clickOverlay();

    expect(lastReason(onDestroyed)).toBe("overlay");
  });

  it("forgets a cancelled close once the tour moves on", async () => {
    const onDestroyed = vi.fn();
    // Cancels every close attempt by not calling destroy().
    const onDestroyStarted = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyStarted, onDestroyed });
    d.drive();
    await nextFrame();

    navButton("close")?.click();
    expect(d.isActive()).toBe(true);

    d.moveNext();
    d.destroy();

    expect(lastReason(onDestroyed)).toBe("api");
  });

  it("is passed to onDeselected on destroy but not on a step change", async () => {
    const onDeselected = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDeselected });
    d.drive();
    await nextFrame();

    d.moveNext();
    await nextFrame();
    expect(onDeselected.mock.calls[0][2].reason).toBeUndefined();

    navButton("close")?.click();
    expect(onDeselected.mock.calls.at(-1)?.[2].reason).toBe("close");
  });

  it("keeps 'done' when an onDoneClick hook calls destroy()", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({
      animate: false,
      steps: ONE_STEP,
      onDoneClick: (_el, _step, { driver }) => driver.destroy(),
      onDestroyed,
    });
    d.drive();
    await nextFrame();

    navButton("next")?.click();

    expect(lastReason(onDestroyed)).toBe("done");
  });

  it("keeps 'done' when an onNextClick hook on the last step is run by the right arrow", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({
      animate: false,
      steps: ONE_STEP,
      onNextClick: (_el, _step, { driver }) => driver.destroy(),
      onDestroyed,
    });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");

    expect(lastReason(onDestroyed)).toBe("done");
  });

  it("does not report 'done' when an onNextClick hook on a middle step calls destroy()", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({
      animate: false,
      steps: SAMPLE_STEPS,
      onNextClick: (_el, _step, { driver }) => driver.destroy(),
      onDestroyed,
    });
    d.drive();
    await nextFrame();

    navButton("next")?.click();

    expect(lastReason(onDestroyed)).toBe("api");
  });

  it("is only passed to the hooks that run on destroy", async () => {
    const onHighlighted = vi.fn();
    const onNextClick = vi.fn((_el, _step, { driver }) => driver.moveNext());
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onHighlighted, onNextClick });
    d.drive();
    await nextFrame();

    navButton("next")?.click();
    await nextFrame();

    expect(onHighlighted.mock.calls[0][2]).not.toHaveProperty("reason");
    expect(onNextClick.mock.calls[0][2]).not.toHaveProperty("reason");
  });
});

describe("destroy reason for a single highlight", () => {
  const STEP = { element: "#intro", popover: { title: "Highlight" } };

  it("is 'escape' when the escape key closes it", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, onDestroyed });
    d.highlight(STEP);
    await nextFrame();

    pressKey("Escape");

    expect(lastReason(onDestroyed)).toBe("escape");
  });

  it("is 'overlay' when an overlay click closes it", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, onDestroyed });
    d.highlight(STEP);
    await nextFrame();

    clickOverlay();

    expect(lastReason(onDestroyed)).toBe("overlay");
  });

  it("is 'api' when destroy() is called directly", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, onDestroyed });
    d.highlight(STEP);
    await nextFrame();

    d.destroy();

    expect(lastReason(onDestroyed)).toBe("api");
  });

  it("is 'replaced' when a tour starts on top of it", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, onDestroyed });
    d.highlight(STEP);
    await nextFrame();

    createDriver({ animate: false, steps: ONE_STEP }).drive();

    expect(lastReason(onDestroyed)).toBe("replaced");
  });

  it("forgets a cancelled close when highlighting again", async () => {
    const onDestroyed = vi.fn();
    const onDestroyStarted = vi.fn();
    const d = createDriver({ animate: false, onDestroyStarted, onDestroyed });
    d.highlight(STEP);
    await nextFrame();

    pressKey("Escape");
    expect(d.isActive()).toBe(true);

    d.highlight({ element: "#card-1", popover: { title: "Another" } });
    await nextFrame();
    d.destroy();

    expect(lastReason(onDestroyed)).toBe("api");
  });
});
