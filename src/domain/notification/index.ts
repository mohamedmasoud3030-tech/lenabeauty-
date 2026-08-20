/**
 * Notification domain — provider-neutral core of the communication system.
 * Channels are adapters; business logic never references a provider.
 */

export * from "./types";
export * from "./events";
export * from "./templates";
export * from "./preferences";
export * from "./dedup";
export * from "./service";
