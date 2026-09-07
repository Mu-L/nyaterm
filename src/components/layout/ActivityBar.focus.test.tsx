import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { preventActivityBarSettingsMouseFocus } from "./ActivityBar";

describe("ActivityBar settings focus", () => {
  it("keeps content focus on primary mouse down while preserving click", () => {
    const onClick = vi.fn();
    render(<ActivityBarButtonHarness itemId="settings" onClick={onClick} />);
    const contentInput = screen.getByLabelText("content");
    const button = screen.getByRole("button", { name: "settings" });
    contentInput.focus();
    const mouseDown = createEvent.mouseDown(button, { button: 0 });

    fireEvent(button, mouseDown);
    fireEvent.click(button);

    expect(mouseDown.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(contentInput);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not change mouse focus behavior for other activity items", () => {
    render(<ActivityBarButtonHarness itemId="fileExplorer" />);
    const button = screen.getByRole("button", { name: "fileExplorer" });
    const mouseDown = createEvent.mouseDown(button, { button: 0 });

    fireEvent(button, mouseDown);

    expect(mouseDown.defaultPrevented).toBe(false);
  });

  it.each(["{Enter}", " "])("still supports keyboard activation with %s", async (key) => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ActivityBarButtonHarness itemId="settings" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "settings" });
    button.focus();

    await user.keyboard(key);

    expect(document.activeElement).toBe(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

function ActivityBarButtonHarness({
  itemId,
  onClick = vi.fn(),
}: {
  itemId: string;
  onClick?: () => void;
}) {
  return (
    <>
      <input aria-label="content" />
      <button
        type="button"
        aria-label={itemId}
        onMouseDown={(event) => preventActivityBarSettingsMouseFocus(event, itemId)}
        onClick={onClick}
      />
    </>
  );
}
