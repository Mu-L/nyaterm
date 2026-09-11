import type { Terminal } from "@xterm/xterm";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platform", () => ({
  isLinux: false,
  isMacOS: true,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { installImeCompatibilityPatch } from "./xtermImeCompatibility";

interface FakeCompositionHelper {
  _isComposing: boolean;
  _isSendingComposition: boolean;
  _textareaChangeTimer?: number;
  compositionstart: () => void;
}

interface FakeCore {
  _inputEvent: (event: InputEvent) => unknown;
  _keyDownSeen: boolean;
  _compositionHelper: FakeCompositionHelper;
  textarea: HTMLTextAreaElement;
}

function createHarness() {
  const textarea = document.createElement("textarea");
  const observedKeyDownSeen: boolean[] = [];
  const originalInputEvent = vi.fn(function (this: FakeCore) {
    observedKeyDownSeen.push(this._keyDownSeen);
    return true;
  });
  const core: FakeCore = {
    _inputEvent: originalInputEvent,
    _keyDownSeen: false,
    _compositionHelper: {
      _isComposing: false,
      _isSendingComposition: false,
      compositionstart: vi.fn(),
    },
    textarea,
  };
  const terminal = { _core: core } as unknown as Terminal;

  return { core, observedKeyDownSeen, originalInputEvent, terminal, textarea };
}

function dispatchKeydown(
  textarea: HTMLTextAreaElement,
  key: string,
  keyCode: number,
) {
  const event = new KeyboardEvent("keydown", { bubbles: true, key });
  Object.defineProperty(event, "keyCode", { value: keyCode });
  textarea.dispatchEvent(event);
}

function inputEvent(data: string): InputEvent {
  return {
    data,
    inputType: "insertText",
    isComposing: false,
  } as InputEvent;
}

describe("xterm IME compatibility", () => {
  it("forces the first direct-commit character after a held modifier", () => {
    const { core, observedKeyDownSeen, terminal, textarea } = createHarness();
    const patch = installImeCompatibilityPatch(terminal, true);

    dispatchKeydown(textarea, "Shift", 16);
    core._keyDownSeen = true;
    core._inputEvent(inputEvent("$"));

    expect(observedKeyDownSeen).toEqual([false]);
    expect(core._keyDownSeen).toBe(true);
    patch.dispose();
  });

  it("keeps the existing keyCode 229 compatibility path", () => {
    const { core, observedKeyDownSeen, terminal, textarea } = createHarness();
    const patch = installImeCompatibilityPatch(terminal, true);

    dispatchKeydown(textarea, "a", 229);
    core._keyDownSeen = true;
    core._inputEvent(inputEvent("a"));

    expect(observedKeyDownSeen).toEqual([false]);
    patch.dispose();
  });

  it("does not force normal Shift plus physical-key input", () => {
    const { core, observedKeyDownSeen, terminal, textarea } = createHarness();
    const patch = installImeCompatibilityPatch(terminal, true);

    dispatchKeydown(textarea, "Shift", 16);
    dispatchKeydown(textarea, "$", 52);
    core._keyDownSeen = true;
    core._inputEvent(inputEvent("$"));

    expect(observedKeyDownSeen).toEqual([true]);
    patch.dispose();
  });

  it("does not force direct commits while composition is active", () => {
    const { core, observedKeyDownSeen, terminal, textarea } = createHarness();
    const patch = installImeCompatibilityPatch(terminal, true);

    core._compositionHelper._isComposing = true;
    dispatchKeydown(textarea, "Shift", 16);
    core._keyDownSeen = true;
    core._inputEvent(inputEvent("$"));

    expect(observedKeyDownSeen).toEqual([true]);
    patch.dispose();
  });
});
