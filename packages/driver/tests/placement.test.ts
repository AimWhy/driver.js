import { describe, expect, it } from "vitest";
import type { Alignment, Side } from "../src/popover";
import { createDriver, nextFrame, popoverEl, useDriverHarness } from "./utils";

useDriverHarness();

// Characterization tests for the popover box placement in repositionPopover.
// The arrow geometry is covered in popover.test.ts; these pin where the box
// itself lands, including the stagePadding/popoverOffset arithmetic, so the
// positioning can be refactored without drifting.
//
// jsdom does no layout: the window is a fixed 1024x768, the arrow's bounding
// box reads as 0x0 (so the arrow term in the viewport clamps drops out), and
// both the element and the popover get their boxes stubbed below.

const rect = (over: Partial<DOMRect>): DOMRect =>
  ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;

// The element box used across the cases: 200x20 sitting well inside the
// viewport so every side has room by default.
const ELEMENT_BOX: Partial<DOMRect> = { top: 400, left: 400, right: 600, bottom: 420, width: 200, height: 20 };

// The popover box: 200x100. Only the size matters for the box placement.
const POPOVER_BOX: Partial<DOMRect> = { top: 100, left: 600, right: 800, bottom: 400, width: 200, height: 100 };

async function placePopover(opts: {
  side: Side;
  align?: Alignment;
  element?: Partial<DOMRect>;
  stagePadding?: number;
  popoverOffset?: number;
}): Promise<HTMLElement> {
  const el = document.querySelector<HTMLElement>("#intro")!;
  el.getBoundingClientRect = () => rect(opts.element ?? ELEMENT_BOX);
  // jsdom has no scrollIntoView; off-screen element boxes would otherwise throw.
  el.scrollIntoView = () => {};

  // Spreading an explicit `undefined` would override the config defaults, so
  // only pass the overrides that are actually set.
  const d = createDriver({
    animate: false,
    ...(opts.stagePadding !== undefined ? { stagePadding: opts.stagePadding } : {}),
    ...(opts.popoverOffset !== undefined ? { popoverOffset: opts.popoverOffset } : {}),
  });
  d.highlight({ element: "#intro", popover: { title: "Intro", side: opts.side, align: opts.align ?? "start" } });

  const wrapper = popoverEl() as HTMLElement;
  wrapper.getBoundingClientRect = () => rect(POPOVER_BOX);

  d.refresh();
  await nextFrame();

  // Tear down before returning so a test can place twice without the first
  // popover lingering in the DOM; the detached wrapper keeps its styles.
  d.destroy();

  return wrapper;
}

describe("popover box placement", () => {
  // With the default stagePadding (10) and popoverOffset (10) the popover is
  // kept 20px clear of the element box, and align "start" pulls the popover
  // back by stagePadding so it lines up with the highlight cutout.

  it("places a top popover above the element, offset by padding and offset", async () => {
    // top: 400 - (100 + 10 + 10) = 280; left: 400 - 10 = 390.
    const wrapper = await placePopover({ side: "top" });

    expect(wrapper.style.top).toBe("280px");
    expect(wrapper.style.left).toBe("390px");
    expect(wrapper.style.bottom).toBe("auto");
    expect(wrapper.style.right).toBe("auto");
    expect(wrapper.classList.contains("driver-popover-side-top")).toBe(true);
    expect(wrapper.classList.contains("driver-popover-align-start")).toBe(true);
  });

  it("places a bottom popover through the bottom style property", async () => {
    // bottom: 768 - (420 + 120) = 228 measured from the viewport's bottom edge.
    const wrapper = await placePopover({ side: "bottom" });

    expect(wrapper.style.bottom).toBe("228px");
    expect(wrapper.style.left).toBe("390px");
    expect(wrapper.style.top).toBe("auto");
    expect(wrapper.classList.contains("driver-popover-side-bottom")).toBe(true);
  });

  it("places a left popover beside the element", async () => {
    // left: 400 - (200 + 20) = 180; top mirrors the align "start" formula: 390.
    const wrapper = await placePopover({ side: "left" });

    expect(wrapper.style.left).toBe("180px");
    expect(wrapper.style.top).toBe("390px");
    expect(wrapper.style.right).toBe("auto");
    expect(wrapper.classList.contains("driver-popover-side-left")).toBe(true);
  });

  it("places a right popover through the right style property", async () => {
    // right: 1024 - (600 + 220) = 204 measured from the viewport's right edge.
    const wrapper = await placePopover({ side: "right" });

    expect(wrapper.style.right).toBe("204px");
    expect(wrapper.style.top).toBe("390px");
    expect(wrapper.style.left).toBe("auto");
    expect(wrapper.classList.contains("driver-popover-side-right")).toBe(true);
  });

  it("centers the popover on the element for align center", async () => {
    // Element center x = 500, popover width 200 → left: 500 - 100 = 400.
    const wrapper = await placePopover({ side: "top", align: "center" });

    expect(wrapper.style.left).toBe("400px");
    expect(wrapper.classList.contains("driver-popover-align-center")).toBe(true);
  });

  it("aligns the popover's far edge for align end", async () => {
    // left: 400 - 200 + 200 + 10 = 410 (element end plus stagePadding).
    const wrapper = await placePopover({ side: "top", align: "end" });

    expect(wrapper.style.left).toBe("410px");
    expect(wrapper.classList.contains("driver-popover-align-end")).toBe(true);
  });

  it("distances the popover by stagePadding on both axes", async () => {
    // stagePadding feeds the gap to the element (top) and the align "start"
    // pull-back (left). With padding 0: top 400 - 110 = 290, left 400.
    const flush = await placePopover({ side: "top", stagePadding: 0 });
    expect(flush.style.top).toBe("290px");
    expect(flush.style.left).toBe("400px");

    // With padding 30: top 400 - 140 = 260, left 370.
    const padded = await placePopover({ side: "top", stagePadding: 30 });
    expect(padded.style.top).toBe("260px");
    expect(padded.style.left).toBe("370px");
  });

  it("falls back to the left side first when the preferred side has no room", async () => {
    // The element sits too close to the top for a 120px-tall popover, so the
    // requested "top" is rejected and the fallback order (left before right,
    // top and bottom) kicks in — the left side has room and wins.
    const wrapper = await placePopover({
      side: "top",
      element: { top: 50, left: 400, right: 600, bottom: 70, width: 200, height: 20 },
    });

    expect(wrapper.classList.contains("driver-popover-side-left")).toBe(true);
    expect(wrapper.style.left).toBe("180px");
  });

  it("pins the popover to the bottom center when no side has room", async () => {
    const wrapper = await placePopover({
      side: "top",
      element: { top: 0, left: 0, right: 1024, bottom: 768, width: 1024, height: 768 },
    });

    // Horizontally centered (512 - 100) and 10px off the bottom edge.
    expect(wrapper.style.left).toBe("412px");
    expect(wrapper.style.bottom).toBe("10px");
    expect(wrapper.style.top).toBe("auto");
  });

  it("centers a free-floating popover in the viewport", async () => {
    const d = createDriver({ animate: false });
    d.highlight({ popover: { title: "Floating" } });

    const wrapper = popoverEl() as HTMLElement;
    wrapper.getBoundingClientRect = () => rect(POPOVER_BOX);
    d.refresh();
    await nextFrame();

    // left: 512 - 100 = 412; top: 384 - 50 = 334.
    expect(wrapper.style.left).toBe("412px");
    expect(wrapper.style.top).toBe("334px");
  });
});
