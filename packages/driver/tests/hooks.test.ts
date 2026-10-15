import { describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, navButton, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

describe("lifecycle hooks", () => {
  it("fires onHighlightStarted synchronously with the element, step and options", () => {
    const onHighlightStarted = vi.fn();
    const d = createDriver({ animate: false, onHighlightStarted });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
    const [element, step, options] = onHighlightStarted.mock.calls[0];
    expect(element).toBe(document.querySelector("#intro"));
    expect(step.popover?.title).toBe("Intro");
    expect(options).toMatchObject({ config: expect.any(Object), state: expect.any(Object) });
    expect(options.driver).toBe(d);
  });

  it("fires onHighlighted once the highlight settles", async () => {
    const onHighlighted = vi.fn();
    const d = createDriver({ animate: false, onHighlighted });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    await nextFrame();
    expect(onHighlighted).toHaveBeenCalledTimes(1);
  });

  it("fires onDeselected and onDestroyed on destroy", async () => {
    const onDeselected = vi.fn();
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, onDeselected, onDestroyed });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });
    // The active element/step are committed in the rAF loop; let it run.
    await nextFrame();
    d.destroy();

    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
  });

  it("passes the active state to onDestroyed", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    d.drive(1);
    await nextFrame();
    d.destroy();

    const [, , options] = onDestroyed.mock.calls[0];
    expect(options.state.activeIndex).toBe(1);
    expect(options.state.activeElement).toBe(document.querySelector("#card-1"));
  });

  it("fires onDestroyStarted when closing, leaving teardown to the hook", () => {
    const onDestroyStarted = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyStarted });
    d.drive();
    navButton("close")?.click();

    expect(onDestroyStarted).toHaveBeenCalledTimes(1);
    // The hook didn't call destroy(), so the tour stays active.
    expect(d.isActive()).toBe(true);
  });

  it("supports step-level hooks", () => {
    const onHighlightStarted = vi.fn();
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" }, onHighlightStarted });

    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
  });
});

describe("hook opts index", () => {
  it("exposes the active step index to state hooks", async () => {
    const onHighlighted = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onHighlighted });
    d.drive(1);
    await nextFrame();

    const [, , options] = onHighlighted.mock.calls[0];
    expect(options.index).toBe(1);
  });

  it("exposes the index to popover button hooks", () => {
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onNextClick });
    d.drive(0);
    navButton("next")?.click();

    const [, , options] = onNextClick.mock.calls[0];
    expect(options.index).toBe(0);
  });

  it("exposes the index to onPopoverRender", () => {
    const onPopoverRender = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onPopoverRender });
    d.drive(2);

    const [, options] = onPopoverRender.mock.calls[0];
    expect(options.index).toBe(2);
  });

  it("exposes the pre-destroy index to onDeselected and onDestroyed", async () => {
    const onDeselected = vi.fn();
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDeselected, onDestroyed });
    d.drive(2);
    await nextFrame();
    d.destroy();

    expect(onDeselected.mock.calls[0][2].index).toBe(2);
    expect(onDestroyed.mock.calls[0][2].index).toBe(2);
  });

  it("reports the now-active index in onDeselected during a transition", async () => {
    const onDeselected = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDeselected });
    d.drive(0);
    // Let the first highlight commit so moveNext is a real transition.
    await nextFrame();
    d.moveNext();

    const [, , options] = onDeselected.mock.calls[0];
    expect(options.index).toBe(1);
  });

  it("fires onDeselected between two steps without an element", async () => {
    const onDeselected = vi.fn();
    const d = createDriver({
      animate: false,
      onDeselected,
      steps: [{ popover: { title: "One" } }, { popover: { title: "Two" } }],
    });
    d.drive();
    await nextFrame();
    d.moveNext();

    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(onDeselected.mock.calls[0][0]).toBeUndefined();
    expect(onDeselected.mock.calls[0][1].popover.title).toBe("One");
  });

  it("fires onDeselected between two steps on the same element", async () => {
    const onDeselected = vi.fn();
    const d = createDriver({
      animate: false,
      onDeselected,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#intro", popover: { title: "Two" } },
      ],
    });
    d.drive();
    await nextFrame();
    d.moveNext();

    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(onDeselected.mock.calls[0][1].popover.title).toBe("One");
  });
});
