import { driver } from "driver.js";
import { hints } from "driver.js/hints";
import type { ExampleGroup } from "./types";

const STORAGE_KEY = "driver-playground-dismissed-hints";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export const hintsGroup: ExampleGroup = {
  title: "Hints",
  examples: [
    {
      id: "hints-basic",
      title: "Basic Hints",
      description:
        "Beacons sit on the page until you click one. There is no overlay and the page stays interactive, so open them in any order — or ignore them entirely.",
      run() {
        hints({
          hints: [
            {
              element: ".page-header h1",
              id: "title",
              popover: {
                title: "Hints",
                description:
                  "A hint is a self-contained callout: one beacon, one popover, one dismiss button. No steps, no next and previous.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: "#card-3",
              id: "cards",
              popover: {
                title: "Open in Any Order",
                description:
                  "Every beacon is live at once. Opening this one closed the other, since only one hint is ever open.",
                side: "top",
                align: "center",
              },
            },
            {
              element: ".feature-list",
              id: "features",
              popover: {
                title: "Click, Escape or Click Away",
                description:
                  "Clicking the beacon again, pressing Escape or clicking outside closes the popover but keeps the beacon. Only Got it dismisses the hint.",
                side: "right",
                align: "start",
              },
            },
          ],
        }).show();
      },
    },
    {
      id: "hints-beacon-placement",
      title: "Beacon Placement",
      description:
        "A beacon sits at one of the twelve anchor points of its element's box — a side (top, right, bottom, left) plus an alignment (start, center, end). The default is the top-right corner.",
      run() {
        hints({
          hints: [
            {
              element: "#card-1",
              id: "top-start",
              beacon: { side: "top", align: "start" },
              popover: { title: "top / start", description: "The beacon sits on the top edge, at its start.", side: "top" },
            },
            {
              element: "#card-2",
              id: "top-end",
              popover: {
                title: "top / end (default)",
                description: "With no beacon config a hint lands on the top-right corner.",
                side: "top",
              },
            },
            {
              element: "#card-4",
              id: "bottom-center",
              beacon: { side: "bottom", align: "center" },
              popover: { title: "bottom / center", description: "Centered along the bottom edge.", side: "bottom" },
            },
            {
              element: "#card-6",
              id: "right-center",
              beacon: { side: "right", align: "center" },
              popover: { title: "right / center", description: "Centered on the right edge.", side: "right" },
            },
            {
              element: "#large-paragraph-text",
              id: "static",
              beacon: { side: "left", align: "center", animate: false },
              popover: {
                title: "No Pulse",
                description:
                  "animate: false drops the pulse and leaves a static dot. The pulse also stops on its own when the reader prefers reduced motion.",
                side: "right",
                align: "start",
              },
            },
          ],
        }).show();
      },
    },
    {
      id: "hints-persistence",
      title: "Persisted Dismissals",
      description:
        "Dismissals are per-instance and last for the session. onDismiss plus a stable id is the hook for making them stick — here through localStorage, so dismissed hints stay gone across reloads.",
      run() {
        const dismissed = new Set(readDismissed());

        const allHints = [
          {
            element: ".page-header",
            id: "persist-header",
            popover: {
              title: "Dismiss Me",
              description: "Hit Got it, then reload the page. This hint will not come back.",
              side: "bottom" as const,
              align: "start" as const,
            },
          },
          {
            element: ".buttons",
            id: "persist-buttons",
            popover: {
              title: "And Me",
              description: "Each dismissal is stored by its id, so the rest of the hints are unaffected.",
              side: "top" as const,
              align: "start" as const,
            },
          },
        ];

        const productHints = hints({
          // Filtering up front is all it takes; the library keeps no storage of
          // its own, which leaves the policy (and the key) entirely yours.
          hints: allHints.filter(hint => !dismissed.has(hint.id)),
          onDismiss: (_element, hint) => {
            dismissed.add(hint.id!);
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
          },
        });

        productHints.show();

        if (dismissed.size) {
          console.log(
            `${dismissed.size} hint(s) previously dismissed. To bring them back:\n` +
              `localStorage.removeItem("${STORAGE_KEY}"); location.reload();`
          );
        }
      },
    },
    {
      id: "hints-with-tour",
      title: "Hints and Tours",
      description:
        "Hints and tours coexist without knowing about each other. Open the hint and start the tour from it: the beacons step aside while the tour runs, then come back on their own.",
      run() {
        const tour = driver({
          showProgress: true,
          steps: [
            {
              element: ".page-header",
              popover: {
                title: "The Tour Has the Screen",
                description: "While a tour is running the beacons are hidden, so the two never compete for attention.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: ".feature-list",
              popover: {
                title: "Still No Coupling",
                description:
                  "Nothing was registered between the two. The tour marks the page while it runs and the hints take the cue from that.",
                side: "top",
                align: "start",
              },
            },
            {
              popover: {
                title: "Back to the Hints",
                description: "Close this and the beacons reappear exactly as they were — including any you dismissed.",
              },
            },
          ],
        });

        hints({
          hints: [
            {
              element: "#card-2",
              id: "launcher",
              popover: {
                title: "Start the Tour",
                description: "Hint popovers are ordinary driver popovers, so onPopoverRender can add a button.",
                side: "top",
                align: "center",
                onPopoverRender: (popover, { hints: instance }) => {
                  const button = document.createElement("button");
                  button.type = "button";
                  button.classList.add("driver-popover-footer-btn");
                  button.innerText = "Take the tour";
                  button.addEventListener("click", () => {
                    instance.close();
                    tour.drive();
                  });

                  popover.footerButtons.prepend(button);
                },
              },
            },
            {
              element: "#scrollable-area",
              id: "scrolls",
              popover: {
                title: "Scrolling Is Handled",
                description:
                  "Scroll this box: the beacon tracks its element, and hides itself once the element leaves the container.",
                side: "top",
                align: "start",
              },
            },
          ],
        }).show();
      },
    },
    {
      id: "hints-modal-dialog",
      title: "Hints in a Modal Dialog",
      description:
        "A dialog opened with showModal() renders in the browser's top layer. The beacon and popover of a hint inside it must render in the dialog too, or they end up hidden behind it.",
      run() {
        const dialog = document.createElement("dialog");
        dialog.className = "m-auto rounded-lg p-6 shadow-xl backdrop:bg-black/40";
        dialog.innerHTML = `
          <h2 class="mb-2 text-xl font-semibold">Native modal dialog</h2>
          <p class="mb-4">There should be a beacon on the Save button.</p>
          <div class="flex gap-2.5">
            <button id="dialog-save" type="button" class="rounded-md border border-gray-300 px-4 py-1.5">Save</button>
            <button id="dialog-close" type="button" class="rounded-md border border-gray-300 px-4 py-1.5">Close</button>
          </div>
        `;
        document.body.appendChild(dialog);
        dialog.querySelector("#dialog-close")!.addEventListener("click", () => dialog.close());
        dialog.showModal();

        hints({
          overlay: true,
          hints: [
            {
              element: "#dialog-save",
              id: "dialog-save",
              popover: {
                title: "Inside the Dialog",
                description: "This beacon and popover have to render inside the modal dialog to be visible.",
                side: "bottom",
                align: "start",
              },
            },
          ],
        }).show();
      },
    },
  ],
};
