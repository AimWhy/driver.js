import { useEffect, useRef, useState } from "react";
import type { Checklist, ChecklistConfig } from "driver.js/checklist";
import { checklist } from "driver.js/checklist";
import "driver.js/dist/driver.css";
import "driver.js/dist/checklist.css";

type ChecklistSampleProps = {
  // Options on top of the sample's items (title, className, position, ...).
  config?: Partial<ChecklistConfig>;
  // Prefixes the ids of the mock UI below so several samples can share a page.
  idPrefix?: string;
  buttonText?: string;
};

// Only one sample's checklist is on screen at a time; showing another one
// hides the previous sample's.
let hideActiveSample: (() => void) | undefined;

// A small mock app the checklist items point at, so every sample is
// self-contained: one item tours it, one waits for the GitHub button.
export function ChecklistSample(props: ChecklistSampleProps) {
  const { buttonText = "Show Checklist", idPrefix = "checklist-demo" } = props;
  const instance = useRef<Checklist | null>(null);
  const githubConnected = useRef(false);
  const [visible, setVisible] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return () => instance.current?.hide();
  }, []);

  function createChecklist(): Checklist {
    return checklist({
      id: `docs-${idPrefix}`,
      title: "Get started",
      description: "Four steps to your first project.",
      items: [
        {
          id: "tour",
          title: "Take the tour",
          description: "A two-step tour of the dashboard.",
          tour: [
            {
              element: `#${idPrefix}-new`,
              popover: { title: "New Project", description: "Projects hold your tours and checklists." },
            },
            {
              element: `#${idPrefix}-github`,
              popover: {
                title: "Connect GitHub",
                description: "Finish this tour to tick the item. Close it early and it stays open.",
              },
            },
          ],
        },
        {
          id: "github",
          title: "Connect GitHub",
          description: "Ticks itself once you click Connect GitHub.",
          completeWhen: () => githubConnected.current,
        },
        {
          id: "invite",
          title: "Invite a teammate",
          description: "Runs your own code, then ticks.",
          action: () => {},
        },
        {
          id: "docs",
          title: "Read about saving progress",
          href: "#saving-progress",
        },
      ],
      ...props.config,
    });
  }

  function hide() {
    instance.current?.hide();
    setVisible(false);
  }

  function onToggle() {
    if (visible) {
      hide();
      hideActiveSample = undefined;
      return;
    }

    if (hideActiveSample) {
      hideActiveSample();
    }

    instance.current = instance.current || createChecklist();
    instance.current.show();
    instance.current.open();
    hideActiveSample = hide;
    setVisible(true);
  }

  function onConnect() {
    githubConnected.current = true;
    setConnected(true);
    instance.current?.refresh();
  }

  function onReset() {
    githubConnected.current = false;
    setConnected(false);
    instance.current?.reset();
  }

  return (
    <div className="my-6">
      <div className="rounded-lg border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-lg font-semibold">Dashboard</span>
          <span className="flex gap-2">
            <button
              id={`${idPrefix}-new`}
              type="button"
              className="cursor-pointer rounded-md border border-gray-300 px-3 py-1 text-sm"
            >
              New Project
            </button>
            <button
              id={`${idPrefix}-github`}
              type="button"
              onClick={onConnect}
              className="cursor-pointer rounded-md border border-gray-300 px-3 py-1 text-sm"
            >
              {connected ? "GitHub Connected" : "Connect GitHub"}
            </button>
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="cursor-pointer rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          {visible ? "Hide Checklist" : buttonText}
        </button>
        {visible && (
          <button
            type="button"
            onClick={onReset}
            className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm"
          >
            Reset Progress
          </button>
        )}
      </div>
    </div>
  );
}
