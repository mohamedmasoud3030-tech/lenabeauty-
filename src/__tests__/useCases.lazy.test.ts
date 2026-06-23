import { describe, expect, it, vi } from "vitest";
import * as repositoryFactory from "../infrastructure/createRepositoryBundle";

describe("useCases composition", () => {
  it("does not create repositories at module import time", async () => {
    vi.resetModules();
    const createRepositoryBundle = vi.spyOn(repositoryFactory, "createRepositoryBundle");

    await import("../app/composition/useCases");

    expect(createRepositoryBundle).not.toHaveBeenCalled();
    createRepositoryBundle.mockRestore();
  });
});
