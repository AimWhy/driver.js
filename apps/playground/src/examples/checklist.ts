import { driver } from "driver.js";
import { checklist } from "driver.js/checklist";
import type { ExampleGroup } from "./types";
import { basicTourSteps } from "./shared";

const STORAGE_KEY = "driver-playground-checklist";

function readCompleted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export const checklistGroup: ExampleGroup = {
  title: "Checklist",
  examples: [
    {
      id: "checklist-basic",
      title: "Onboarding Checklist",
      description:
        "Items start a tour, follow a link or wait for something to happen on the page. Finish the tour to tick it; close it early and it stays open. Progress is saved to localStorage, so it survives a reload.",
      run() {
        let cardClicked = false;
        document.querySelectorAll("#card-1, #card-2, #card-3").forEach(card => {
          card.addEventListener("click", () => {
            cardClicked = true;
            list.refresh();
          });
        });

        const list = checklist({
          id: "playground-onboarding",
          title: "Get started",
          description: "Three quick steps to learn your way around.",
          completed: readCompleted(),
          items: [
            {
              id: "tour",
              title: "Take the tour",
              description: "A short walk through the page.",
              tour: basicTourSteps,
            },
            {
              id: "own-driver",
              title: "Meet the cards",
              description: "Runs a driver() instance you created yourself.",
              tour: driver({
                showProgress: true,
                steps: [
                  { element: "#card-1", popover: { title: "Cards", description: "Each card is a button." } },
                  { element: "#card-2", popover: { title: "Another Card", description: "Try clicking one next." } },
                ],
              }),
            },
            {
              id: "click-card",
              title: "Click any of the first three cards",
              description: "Ticked by completeWhen, as soon as you do it.",
              completeWhen: () => cardClicked,
            },
            {
              id: "docs",
              title: "Read the docs",
              description: "Opens the docs and ticks itself.",
              href: "#docs",
            },
          ],
          onProgress: ({ completed }) => localStorage.setItem(STORAGE_KEY, JSON.stringify(completed)),
          onEvent: event => console.log("[checklist]", event.type, event),
          onComplete: () => console.log("[checklist] all done"),
        });

        list.show();
        list.open();
      },
    },
    {
      id: "checklist-reset",
      title: "Reset Checklist Progress",
      description: "Clears the progress saved by the Onboarding Checklist example, then shows it on the left.",
      run() {
        localStorage.removeItem(STORAGE_KEY);

        const list = checklist({
          id: "playground-onboarding",
          position: "bottom-left",
          items: [
            { id: "tour", title: "Take the tour", tour: basicTourSteps },
            { id: "docs", title: "Read the docs", href: "#docs" },
          ],
        });

        list.show();
        list.open();
      },
    },
  ],
};
