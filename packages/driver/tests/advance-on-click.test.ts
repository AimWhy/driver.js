import { describe, expect, it, vi } from "vitest";
import { createDriver, navButton, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

// Bubbling like a real user click, so the document-level listener hears it.
function clickElement(selector: string): boolean {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`No element for ${selector}`);
  }

  return element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("advanceOnClick", () => {
  it("advances to the next step when the highlighted element is clicked", async () => {
    const d = createDriver({ animate: false, advanceOnClick: true, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    expect(popoverTitle()).toBe("Step 1");

    clickElement("#intro");
    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");
  });

  it("does not advance on click by default", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    clickElement("#intro");
    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("Step 1");
  });

  it("honours a step-level advanceOnClick over the driver default", async () => {
    const d = createDriver({
      animate: false,
      steps: [{ ...SAMPLE_STEPS[0], advanceOnClick: true }, ...SAMPLE_STEPS.slice(1)],
    });
    d.drive();
    await nextFrame();

    clickElement("#intro");
    expect(d.getActiveIndex()).toBe(1);

    clickElement("#card-1");
    expect(d.getActiveIndex()).toBe(1);
  });

  it("lets a step opt out of the driver-level advanceOnClick", async () => {
    const d = createDriver({
      animate: false,
      advanceOnClick: true,
      steps: [{ ...SAMPLE_STEPS[0], advanceOnClick: false }, ...SAMPLE_STEPS.slice(1)],
    });
    d.drive();
    await nextFrame();

    clickElement("#intro");
    expect(d.getActiveIndex()).toBe(0);
  });

  it("does not prevent the element's own click behaviour", async () => {
    const appHandler = vi.fn();
    document.querySelector("#intro")?.addEventListener("click", appHandler);

    const d = createDriver({ animate: false, advanceOnClick: true, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    const notPrevented = clickElement("#intro");
    expect(notPrevented).toBe(true);
    expect(appHandler).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(1);
  });

  it("ignores clicks outside the highlighted element", async () => {
    const d = createDriver({ animate: false, advanceOnClick: true, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    clickElement("#card-1");
    expect(d.getActiveIndex()).toBe(0);
  });

  it("runs onNextClick instead of moving when provided", async () => {
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, advanceOnClick: true, onNextClick, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    clickElement("#intro");
    expect(onNextClick).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(0);
  });

  it("destroys the tour when the last step's element is clicked", async () => {
    const d = createDriver({ animate: false, advanceOnClick: true, steps: SAMPLE_STEPS });
    d.drive(2);
    await nextFrame();

    clickElement(".feature-list");
    expect(d.isActive()).toBe(false);
  });

  it("runs onDoneClick when the last step's element is clicked", async () => {
    const onDoneClick = vi.fn();
    const d = createDriver({ animate: false, advanceOnClick: true, onDoneClick, steps: SAMPLE_STEPS });
    d.drive(2);
    await nextFrame();

    clickElement(".feature-list");
    expect(onDoneClick).toHaveBeenCalledTimes(1);
    expect(d.isActive()).toBe(true);
  });

  it("does not double-advance when the popover's next button is clicked", async () => {
    const d = createDriver({ animate: false, advanceOnClick: true, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    navButton("next")?.click();
    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");
  });
});
