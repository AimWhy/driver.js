import { driver, type Config, type DestroyReason } from "driver.js";
import type { ExampleGroup } from "./types";
import { basicTourSteps } from "./shared";

// A panel pinned above driver's overlay and popover, so its buttons stay
// clickable while a tour runs. Every reason a tour ends with is logged here
// (and to the console).
function mountReasonPanel(actions: { label: string; run: () => void }[]) {
  const panel = document.createElement("div");
  panel.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:1000000001",
    "width:280px",
    "padding:12px",
    "border:1px solid #d1d5db",
    "border-radius:8px",
    "background:#fff",
    "box-shadow:0 4px 16px rgba(0,0,0,.15)",
    "font:13px/1.4 system-ui,sans-serif",
    "color:#111",
  ].join(";");

  const heading = document.createElement("strong");
  heading.textContent = "Destroy reasons";

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin:8px 0";
  actions.forEach(({ label, run }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText =
      "padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;background:#f9fafb";
    button.addEventListener("click", run);
    buttons.appendChild(button);
  });

  const log = document.createElement("ol");
  log.setAttribute("aria-live", "polite");
  log.style.cssText = "margin:0;padding-left:18px;max-height:160px;overflow:auto";

  panel.append(heading, buttons, log);
  document.body.appendChild(panel);

  return (source: string, reason: DestroyReason | undefined, stepIndex: number | undefined) => {
    const entry = document.createElement("li");
    entry.innerHTML = `<code>${source}</code> → <strong>${reason}</strong> <span style="color:#6b7280">(step ${
      stepIndex === undefined ? "–" : stepIndex + 1
    })</span>`;
    log.prepend(entry);
    console.log(`[${source}] onDestroyed reason:`, reason, "step:", stepIndex);
  };
}

export const destroyReasonGroup: ExampleGroup = {
  title: "Destroy Reason",
  examples: [
    {
      id: "destroy-reason",
      title: "Why the Tour Ended",
      description:
        "onDestroyed receives options.reason. End the tour any way you like — finish it, close it, press Escape, click the overlay — or use the panel buttons to end it from code, jump out of range, or start another instance on top. Each ending is logged in the panel.",
      run() {
        const log = mountReasonPanel([
          { label: "Start tour", run: () => tour.drive() },
          {
            label: "Highlight",
            run: () =>
              single.highlight({
                element: ".buttons",
                popover: {
                  title: "Single highlight",
                  description: "Escape, overlay click, or a panel button ends this one.",
                },
              }),
          },
          { label: "destroy()", run: () => tour.destroy() },
          { label: "moveTo(99)", run: () => tour.moveTo(99) },
          { label: "Start another", run: () => other.drive() },
        ]);

        const withLog = (source: string): Config => ({
          onDestroyed: (_el, _step, { reason, index }) => log(source, reason, index),
        });

        const tour = driver({ showProgress: true, steps: basicTourSteps, ...withLog("tour") });
        const single = driver({ ...withLog("highlight") });
        const other = driver({
          ...withLog("other"),
          steps: [
            {
              popover: {
                title: "Another instance",
                description: 'Starting this one ended the previous tour with reason "replaced". Close this one too.',
              },
            },
          ],
        });

        tour.drive();
      },
    },
    {
      id: "destroy-reason-confirm",
      title: "Confirm Unless Done",
      description:
        'onDestroyStarted asks for confirmation only when the user is leaving early. Finishing the tour (reason "done") skips the prompt, and the destroy() called from the hook keeps the original reason.',
      run() {
        const log = mountReasonPanel([{ label: "Start tour", run: () => tour.drive() }]);

        const tour = driver({
          showProgress: true,
          steps: basicTourSteps.slice(0, 3),
          onDestroyStarted: (_el, _step, { reason, driver }) => {
            if (reason === "done" || confirm(`Leave the tour? (reason: ${reason})`)) {
              driver.destroy();
            }
          },
          onDestroyed: (_el, _step, { reason, index }) => log("tour", reason, index),
        });

        tour.drive();
      },
    },
  ],
};
