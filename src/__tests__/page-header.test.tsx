import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../shared/components/PageHeader";
import i18n from "../i18n";

describe("PageHeader (shared UX pattern)", () => {
  it("renders title, subtitle and action slot (Arabic)", async () => {
    await i18n.changeLanguage("ar");
    render(
      <PageHeader
        icon={<span>icon</span>}
        title={i18n.t("Appointments")}
        subtitle={i18n.t("Manage your spa schedule")}
        actions={<button>{i18n.t("New Appointment")}</button>}
      />,
    );
    expect(screen.getByText(i18n.t("Appointments"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("Manage your spa schedule"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("New Appointment"))).toBeInTheDocument();
  });

  it("renders without actions when not provided", async () => {
    await i18n.changeLanguage("ar");
    render(<PageHeader icon={<span>icon</span>} title="العنوان" />);
    expect(screen.getByText("العنوان")).toBeInTheDocument();
  });
});
