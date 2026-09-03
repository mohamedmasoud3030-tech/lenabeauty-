/**
 * Compatibility facade for repository ports.
 *
 * Canonical ownership lives in ./repositories/* by business domain. Keep this
 * facade stable so existing application and infrastructure imports do not
 * change as part of the architectural split.
 */
export * from "./repositories/index";
