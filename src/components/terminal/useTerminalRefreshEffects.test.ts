import { renderHook, waitFor } from "@testing-library/react";
import type { Terminal } from "@xterm/xterm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TerminalFitScheduler } from "./terminalFitScheduler";
import { useTerminalRefreshEffects } from "./useTerminalRefreshEffects";

const windowMocks = vi.hoisted(() => ({
  focusChanged: undefined as ((event: { payload: boolean }) => void) | undefined,
  scaleChanged: undefined as
    | ((event: { payload: { scaleFactor: number } }) => void)
    | undefined,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onResized: async () => vi.fn(),
    onMoved: async () => vi.fn(),
    onFocusChanged: async (callback: (event: { payload: boolean }) => void) => {
      windowMocks.focusChanged = callback;
      return vi.fn();
    },
    onScaleChanged: async (
      callback: (event: { payload: { scaleFactor: number } }) => void,
    ) => {
      windowMocks.scaleChanged = callback;
      return vi.fn();
    },
  }),
}));

describe("useTerminalRefreshEffects", () => {
  beforeEach(() => {
    windowMocks.focusChanged = undefined;
    windowMocks.scaleChanged = undefined;
    vi.restoreAllMocks();
  });

  it("repaints an active visible terminal without texture invalidation", () => {
    const schedule = vi.fn();
    renderHook(() =>
      useTerminalRefreshEffects({
        terminalRef: { current: {} as Terminal },
        fitSchedulerRef: {
          current: { schedule } as unknown as TerminalFitScheduler,
        },
        active: true,
        visible: true,
        terminalReady: true,
        performanceMode: "normal",
        sessionId: "session-1",
        showGutter: false,
        showContentPadding: false,
      }),
    );

    const activeRefresh = schedule.mock.calls
      .map(([request]) => request)
      .find((request) => request.reason === "active");
    expect(activeRefresh).toEqual(
      expect.objectContaining({ force: true, refresh: true, focus: true }),
    );
    expect(activeRefresh).not.toHaveProperty("clearTextureAtlas");
  });

  it("restores the terminal that owned input focus when the native window regains focus", async () => {
    const schedule = vi.fn();
    const focus = vi.fn();
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    textarea.focus();
    renderHook(() =>
      useTerminalRefreshEffects({
        terminalRef: { current: { textarea, focus } as unknown as Terminal },
        fitSchedulerRef: {
          current: { schedule } as unknown as TerminalFitScheduler,
        },
        active: true,
        visible: true,
        terminalReady: true,
        performanceMode: "normal",
        sessionId: "session-1",
        showGutter: false,
        showContentPadding: false,
      }),
    );
    await waitFor(() => expect(windowMocks.focusChanged).toBeTypeOf("function"));
    schedule.mockClear();
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    textarea.dispatchEvent(new FocusEvent("blur", { relatedTarget: null }));

    windowMocks.focusChanged?.({ payload: false });
    expect(schedule).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();

    hasFocus.mockReturnValue(true);
    windowMocks.focusChanged?.({ payload: true });
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "window-focus",
        force: true,
        refresh: true,
        clearTextureAtlas: false,
        focus: false,
      }),
    );
  });

  it("does not reclaim focus after another in-app control owns DOM focus", async () => {
    const schedule = vi.fn();
    const focus = vi.fn();
    const textarea = document.createElement("textarea");
    const searchInput = document.createElement("input");
    document.body.append(textarea, searchInput);
    textarea.focus();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    renderHook(() =>
      useTerminalRefreshEffects({
        terminalRef: { current: { textarea, focus } as unknown as Terminal },
        fitSchedulerRef: {
          current: { schedule } as unknown as TerminalFitScheduler,
        },
        active: true,
        visible: true,
        terminalReady: true,
        performanceMode: "normal",
        sessionId: "session-1",
        showGutter: false,
        showContentPadding: false,
      }),
    );
    await waitFor(() => expect(windowMocks.focusChanged).toBeTypeOf("function"));
    schedule.mockClear();

    textarea.dispatchEvent(
      new FocusEvent("blur", {
        relatedTarget: searchInput,
      }),
    );
    windowMocks.focusChanged?.({ payload: true });

    expect(focus).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "window-focus",
        force: true,
        refresh: true,
        focus: false,
      }),
    );
  });

  it("keeps the active refresh focus path when a hidden terminal becomes active and visible", () => {
    const schedule = vi.fn();
    const terminalRef = { current: {} as Terminal };
    const fitSchedulerRef = {
      current: { schedule } as unknown as TerminalFitScheduler,
    };
    const { rerender } = renderHook(
      ({ active, visible }) =>
        useTerminalRefreshEffects({
          terminalRef,
          fitSchedulerRef,
          active,
          visible,
          terminalReady: true,
          performanceMode: "normal",
          sessionId: "session-1",
          showGutter: false,
          showContentPadding: false,
        }),
      { initialProps: { active: false, visible: false } },
    );
    schedule.mockClear();

    rerender({ active: true, visible: true });

    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "active",
        force: true,
        refresh: true,
        focus: true,
      }),
    );
  });

  it("still invalidates textures after a DPI scale change", async () => {
    const schedule = vi.fn();
    renderHook(() =>
      useTerminalRefreshEffects({
        terminalRef: { current: {} as Terminal },
        fitSchedulerRef: {
          current: { schedule } as unknown as TerminalFitScheduler,
        },
        active: true,
        visible: true,
        terminalReady: true,
        performanceMode: "normal",
        sessionId: "session-1",
        showGutter: false,
        showContentPadding: false,
      }),
    );
    await waitFor(() =>
      expect(windowMocks.scaleChanged).toBeTypeOf("function"),
    );
    windowMocks.scaleChanged?.({ payload: { scaleFactor: 2 } });

    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "scale-factor",
        force: true,
        refresh: true,
        clearTextureAtlas: true,
      }),
    );
  });

  it("suppresses incidental refreshes while a snapshot restore is finalizing", async () => {
    const schedule = vi.fn();
    const snapshotRestoringRef = { current: true };
    renderHook(() =>
      useTerminalRefreshEffects({
        terminalRef: { current: {} as Terminal },
        fitSchedulerRef: {
          current: { schedule } as unknown as TerminalFitScheduler,
        },
        active: true,
        visible: true,
        terminalReady: true,
        performanceMode: "normal",
        sessionId: "session-1",
        showGutter: false,
        showContentPadding: false,
        snapshotRestoringRef,
      }),
    );
    await waitFor(() =>
      expect(windowMocks.scaleChanged).toBeTypeOf("function"),
    );
    schedule.mockClear();

    window.dispatchEvent(new Event("nyaterm:refresh-terminals"));
    windowMocks.scaleChanged?.({ payload: { scaleFactor: 2 } });

    expect(schedule).not.toHaveBeenCalled();
  });
});
