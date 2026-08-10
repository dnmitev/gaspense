import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseForm } from "@/app/cars/[id]/expenses/expense-form";
import type { ActionResult } from "@/app/cars/[id]/expenses/actions";

/**
 * `ExpenseForm`'s two car branches.
 *
 * The per-car routes post a hidden `carId`; the car-agnostic route posts a
 * `<select>`. One form serves both, and which branch renders is worth a unit
 * test — it is a pure function of one prop, and getting it wrong on the per-car
 * route would silently drop the car from the payload.
 *
 * `ExpenseForm` is a client component using `useActionState`, which renders fine
 * under jsdom because the hook is client-side; the action is never invoked here.
 */

const noopAction = async (): Promise<ActionResult> => ({ ok: true });

const categories = [
  { id: "cat-fuel", name: "Fuel" },
  { id: "cat-service", name: "Service" },
];

function renderForm(props: Partial<Parameters<typeof ExpenseForm>[0]> = {}) {
  return render(
    <ExpenseForm
      action={noopAction}
      submitLabel="Add fuel"
      carId="car-1"
      categories={categories}
      {...props}
    />,
  );
}

describe("ExpenseForm — car selection", () => {
  it("posts a hidden carId when no car list is given", () => {
    const { container } = renderForm();

    const hidden = container.querySelector('input[type="hidden"][name="carId"]');
    expect(hidden).not.toBeNull();
    expect(hidden).toHaveValue("car-1");

    expect(screen.queryByRole("combobox", { name: "Car" })).toBeNull();
  });

  it("renders a car select, preselected, when a car list is given", () => {
    renderForm({
      cars: [
        { id: "car-1", label: "Demo car · DEMO-0001" },
        { id: "car-2", label: "DEMO-0002" },
      ],
    });

    const select = screen.getByRole("combobox", { name: "Car" });
    expect(select).toHaveValue("car-1");
    expect(screen.getByRole("option", { name: "DEMO-0002" })).toBeInTheDocument();
  });

  it("names the amount field from its label, not its placeholder", () => {
    // ⚠️ Worth asserting explicitly: the amount input carries
    // placeholder="45.20", and a placeholder alone satisfies axe's
    // WCAG-tagged rules. So the accessibility audit does NOT catch a lost
    // label association here — this test and the keyboard e2e test do.
    renderForm();
    expect(screen.getByLabelText("Amount (€)")).toBeInTheDocument();
  });

  it("focuses the amount field only when asked", () => {
    const { unmount } = renderForm({ focusAmount: true });
    expect(screen.getByLabelText("Amount (€)")).toHaveFocus();
    unmount();

    renderForm();
    expect(screen.getByLabelText("Amount (€)")).not.toHaveFocus();
  });
});
