import { VisitStage } from "../domain/entities";

/**
 * Presentation mapping for the operational visit stages. The domain rules
 * (which transitions are legal, what the effective stage is) live in
 * `src/domain/visit.ts`; this module only maps a stage to its i18n key so the
 * Appointments page and the POS visit context stay in sync.
 */

/** i18n key for a visit stage badge/label. */
export function visitStageI18nKey(stage: VisitStage): string {
  switch (stage) {
    case VisitStage.BOOKED: return "visit.stage.BOOKED";
    case VisitStage.CONFIRMED: return "visit.stage.CONFIRMED";
    case VisitStage.ARRIVED: return "visit.stage.ARRIVED";
    case VisitStage.IN_SERVICE: return "visit.stage.IN_SERVICE";
    case VisitStage.READY_FOR_CHECKOUT: return "visit.stage.READY_FOR_CHECKOUT";
    default: return "visit.stage.BOOKED";
  }
}

/** i18n key for the primary operator action from a stage. */
export function visitActionI18nKey(stage: VisitStage): string {
  switch (stage) {
    case VisitStage.BOOKED:
    case VisitStage.CONFIRMED: return "visit.action.arrived";
    case VisitStage.ARRIVED: return "visit.action.start";
    case VisitStage.IN_SERVICE: return "visit.action.finish";
    case VisitStage.READY_FOR_CHECKOUT: return "visit.action.checkout";
    default: return "visit.advance";
  }
}
