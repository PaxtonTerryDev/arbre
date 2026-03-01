import { describe, it, expect, jest, beforeAll } from "@jest/globals";
import { Arbre, Stdout, info } from "..";

jest.spyOn(global.console, "log").mockImplementation(() => {});

describe("arbre", () => {
  beforeAll(() => {
    Arbre.get_instance().addLayer(new Stdout());
  });

  it("info logs to stdout with correct level and message", async () => {
    info("hello");
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[info\].*hello/),
    );
  });
});
