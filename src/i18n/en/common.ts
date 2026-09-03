import { enCommonCore } from "./common-core";
import { enCommonPlatform } from "./common-platform";
import { enCommonOperations } from "./common-operations";
import { enMarketing } from "./marketing";

/**
 * Compatibility facade for cross-cutting English translations.
 * Canonical ownership lives in the focused modules above; callers keep the
 * existing enCommon contract while the giant single-file dictionary is gone.
 */
export const enCommon = {
  ...enCommonCore,
  ...enCommonPlatform,
  ...enCommonOperations,
  ...enMarketing,
};
