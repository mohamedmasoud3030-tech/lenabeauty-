import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../shared/logger";

/**
 * Contracts for the small shared plumbing: the CSV download helper and the
 * environment-aware logger.
 */

describe("logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("in development, debug/info/log pass through and warn/error surface", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.debug("d");
    logger.info("i");
    logger.log("l");
    logger.warn("w");
    logger.error("e");

    expect(debug).toHaveBeenCalledWith("d");
    expect(info).toHaveBeenCalledWith("i");
    expect(log).toHaveBeenCalledWith("l");
    expect(warn).toHaveBeenCalledWith("w");
    expect(error).toHaveBeenCalledWith("e");
  });

  it("in production builds, debug/info/log go silent while warn/error still surface", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { logger: prodLogger } = await import("../shared/logger");

    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    prodLogger.debug("d");
    prodLogger.info("i");
    prodLogger.log("l");
    prodLogger.warn("w");
    prodLogger.error("e");

    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("w");
    expect(error).toHaveBeenCalledWith("e");
  });
});

describe("downloadCSV", () => {
  afterEach(() => vi.restoreAllMocks());

  it("joins headers and rows with commas, downloads under the given name, and revokes the object URL", async () => {
    const createdUrl = "blob:mock-123";
    const createMock = vi.fn((_blob: Blob) => createdUrl);
    const revokeMock = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createMock, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeMock, configurable: true });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const realCreate = document.createElement.bind(document);
    let captured: HTMLAnchorElement | null = null;
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation(((tag: string) => {
        const el = realCreate(tag);
        if (tag === "a") captured = el as HTMLAnchorElement;
        return el;
      }) as typeof document.createElement);

    const { downloadCSV } = await import("../shared/downloadCSV");
    downloadCSV("customers.csv", ["Name", "Phone"], [
      ["Client A", "123"],
      ["Client B", 9],
    ]);

    expect(createMock).toHaveBeenCalledTimes(1);
    const blob = createMock.mock.calls[0][0];
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    expect(await blob.text()).toBe("Name,Phone\nClient A,123\nClient B,9");

    expect(captured).not.toBeNull();
    expect(captured!.href).toBe(createdUrl);
    expect(captured!.download).toBe("customers.csv");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeMock).toHaveBeenCalledWith(createdUrl);

    createSpy.mockRestore();
  });
});
