import React from "react";
import { useTranslation } from "react-i18next";
import brandingService from "../../infrastructure/services/brandingService";
import { useSalonIdentity } from "../../shared/hooks/useSalonIdentity";


export interface ReportKpi {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export interface ReportCell {
  text: string;
  align?: "start" | "center" | "end";
  bold?: boolean;
  /** 0-100 — renders a printed progress bar in this cell. */
  barPct?: number;
  flag?: "low" | "ok";
}

export interface ReportTable {
  heading: string;
  columns: { label: string; align?: "start" | "center" | "end" }[];
  rows: ReportCell[][];
  footerRow?: ReportCell[];
}

export interface ReportList {
  heading: string;
  items: { label: string; value: string }[];
  ranked?: boolean;
}

export interface ReportSheetModel {
  title: string;
  /** Period + generated-at line shown under the title. */
  docNo: string;
  kpis: ReportKpi[];
  tables?: ReportTable[];
  lists?: ReportList[];
}

interface Props {
  model: ReportSheetModel;
  /**
   * `sourceOnly` marks the off-screen, export-only copy of the sheet: it must
   * NOT own the `#print-area` anchor, so the live preview and the PDF capture
   * can coexist in the DOM at once.
   */
  sourceOnly?: boolean;
}

/**
 * A4 report sheet — the single professional print template shared by the
 * sales, appointments and inventory reports. Renders salon identity from the
 * branding service (logo, name, address, phone) and ends with the fixed
 * developer credit, so the attribution is the same on every deployment.
 */
export const ReportPrintSheet: React.FC<Props> = ({ model, sourceOnly = false }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const salon = useSalonIdentity();
  const footerText = brandingService.getFooterText(isRtl);
  const salonAddress = brandingService.getAddress(isRtl);
  const salonPhone = brandingService.getSetting("phone");

  const salonName = salon.name;

  const renderCell = (cell: ReportCell, key: number) => {
    const cls: React.CSSProperties = {};
    if (cell.align === "center") cls.textAlign = "center";
    else if (cell.align === "end") cls.textAlign = "left";
    return (
      <td key={key} style={cls}>
        {cell.barPct !== undefined ? (
          <span className="lb-bar" style={{ width: "70%" }}>
            <i style={{ width: `${Math.max(0, Math.min(100, cell.barPct))}%` }} />
          </span>
        ) : null}
        {cell.flag === "low" ? <span className="lb-flag-low">{cell.text}</span>
          : cell.flag === "ok" ? <span className="lb-flag-ok">{cell.text}</span>
          : cell.text}
      </td>
    );
  };

  return (
    <div
      {...(!sourceOnly ? { id: "print-area" } : {})}
      className="lb-sheet lb-a4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="lb-topline" aria-hidden="true" />
      <div className="lb-head">
        <div className="lb-brand">
          <div className="lb-mark" aria-hidden="true">
            {salon.logoUrl ? <img src={salon.logoUrl} alt="" /> : <span className="lb-mark-fallback">✦</span>}
          </div>
          <div>
            <div className="lb-name">{salonName}</div>
            <div className="lb-sub">{t("Beauty Center")}</div>
          </div>
        </div>
        <div className="lb-contact">
          {salonAddress ? <b>{salonAddress}</b> : null}
          {salonPhone ? <div>{salonPhone}</div> : null}
        </div>
      </div>

      <div className="lb-body">
        <div className="lb-docrow">
          <span className="lb-doctitle">{model.title}</span>
          <span className="lb-docno">{model.docNo}</span>
        </div>

        {model.kpis.length > 0 && (
          <div className="lb-kpis">
            {model.kpis.map((kpi) => (
              <div key={kpi.label} className={kpi.accent ? "lb-kpi lb-kpi-plum" : "lb-kpi"}>
                <small>{kpi.label}</small>
                <b>{kpi.value}</b>
                {kpi.sub ? <u>{kpi.sub}</u> : null}
              </div>
            ))}
          </div>
        )}

        {model.tables?.map((table) => (
          <section key={table.heading} className="lb-block">
            <h3><i>✦</i> {table.heading}</h3>
            <table className="lb-rt">
              <thead>
                <tr>
                  {table.columns.map((col) => (
                    <th
                      key={col.label}
                      style={col.align === "center" ? { textAlign: "center" } : col.align === "end" ? { textAlign: "left" } : undefined}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>{row.map((cell, cellIndex) => renderCell(cell, cellIndex))}</tr>
                ))}
              </tbody>
              {table.footerRow ? (
                <tfoot>
                  <tr>{table.footerRow.map((cell, cellIndex) => renderCell(cell, cellIndex))}</tr>
                </tfoot>
              ) : null}
            </table>
          </section>
        ))}

        {model.lists && model.lists.length > 0 && (
          <div className={model.lists.length > 1 ? "lb-subgrid" : undefined}>
            {model.lists.map((list) => (
              <section key={list.heading} className="lb-block">
                <h3><i>✦</i> {list.heading}</h3>
                <ul className="lb-rank">
                  {list.items.map((item, index) => (
                    <li key={index}>
                      <span>
                        {list.ranked ? <span className="lb-rank-no">{index + 1}</span> : null}
                        {item.label}
                      </span>
                      <b className="lb-num">{item.value}</b>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="lb-repfoot">
          <span><b>{salonName.toLocaleUpperCase()}</b> — {model.title} · {model.docNo}</span>
          <span>{footerText}</span>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `@media print { @page { size: A4; margin: 0; } }`,
        }}
      />
    </div>
  );
};
