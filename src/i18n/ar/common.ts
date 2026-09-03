import { arCommonCore } from "./common-core";
import { arCommonPlatform } from "./common-platform";
import { arCommonOperations } from "./common-operations";
import { arLaunch } from "./launch";
import { arMarketing } from "./marketing";

/**
 * Compatibility facade for cross-cutting Arabic translations.
 * Canonical ownership lives in the focused modules above; callers keep the
 * existing arCommon contract while the giant single-file dictionary is gone.
 */
export const arCommon = {
  ...arCommonCore,
  ...arCommonPlatform,
  ...arCommonOperations,
  ...arLaunch,
  ...arMarketing,
};