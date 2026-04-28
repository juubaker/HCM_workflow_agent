import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../../src/tools/registry.js";

const ctx = { userId: "emp-001", roles: ["employee"] };

describe("ToolRegistry", () => {
  it("registers and dispatches a handler", async () => {
    const registry = new ToolRegistry().register({
      name: "double",
      description: "doubles a number",
      inputSchema: { type: "object", properties: { n: { type: "number" } } },
      handler: async (input) => (input as { n: number }).n * 2,
    });

    const result = await registry.invoke("double", { n: 21 }, ctx);
    expect(result).toBe(42);
  });

  it("exposes Anthropic-shaped schemas", () => {
    const registry = new ToolRegistry().register({
      name: "noop",
      description: "no operation",
      inputSchema: { type: "object", properties: {} },
      handler: async () => null,
    });

    const schemas = registry.schemas();
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toMatchObject({
      name: "noop",
      description: "no operation",
      input_schema: { type: "object", properties: {} },
    });
  });

  it("rejects duplicate registrations", () => {
    const registry = new ToolRegistry().register({
      name: "dup",
      description: "first",
      inputSchema: { type: "object" },
      handler: async () => null,
    });

    expect(() =>
      registry.register({
        name: "dup",
        description: "second",
        inputSchema: { type: "object" },
        handler: async () => null,
      })
    ).toThrow(/already registered/);
  });

  it("throws on unknown tool", async () => {
    const registry = new ToolRegistry();
    await expect(registry.invoke("ghost", {}, ctx)).rejects.toThrow(
      /Unknown tool/
    );
  });

  it("passes the agent context through to the handler", async () => {
    let captured: typeof ctx | undefined;
    const registry = new ToolRegistry().register({
      name: "whoami",
      description: "reflects ctx",
      inputSchema: { type: "object" },
      handler: async (_input, c) => {
        captured = c;
        return c.userId;
      },
    });

    const result = await registry.invoke("whoami", {}, ctx);
    expect(result).toBe("emp-001");
    expect(captured).toEqual(ctx);
  });
});
