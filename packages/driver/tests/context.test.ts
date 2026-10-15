import { describe, expect, it, vi } from "vitest";
import { createContext } from "../src/context";

// Covers the context internals that are not observable through the public
// driver API; everything observable lives in backward-compat.test.ts,
// config.test.ts and hooks.test.ts.

describe("config store", () => {
  it("replaces the config wholesale on setConfig, re-applying defaults", () => {
    const ctx = createContext({ animate: false });

    ctx.setConfig({ duration: 100 });

    expect(ctx.getConfig("duration")).toBe(100);
    expect(ctx.getConfig("animate")).toBe(true);
  });
});

describe("emitter", () => {
  it("keeps a single listener per event, the last one registered", () => {
    const ctx = createContext();
    const first = vi.fn();
    const second = vi.fn();

    ctx.listen("nextClick", first);
    ctx.listen("nextClick", second);
    ctx.emit("nextClick");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("drops all listeners on resetEmitter", () => {
    const ctx = createContext();
    const listener = vi.fn();

    ctx.listen("nextClick", listener);
    ctx.resetEmitter();
    ctx.emit("nextClick");

    expect(listener).not.toHaveBeenCalled();
  });
});
