import { describe, it, expect } from "vitest";
import { PolicyEngine } from "../src/policy/engine.js";
import {
  enforceSelfServiceScope,
  enforceApprovalAuthority,
  enforceEnrollmentWindow,
} from "../src/policy/rules.js";

describe("PolicyEngine — self-service scope", () => {
  it("allows acting on own records", async () => {
    const engine = new PolicyEngine().use(enforceSelfServiceScope);
    const result = await engine.check({
      tool: "get_pto_balance",
      input: { employeeId: "emp-001" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(true);
  });

  it("denies cross-employee access for non-managers", async () => {
    const engine = new PolicyEngine().use(enforceSelfServiceScope);
    const result = await engine.check({
      tool: "get_pto_balance",
      input: { employeeId: "emp-002" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("cannot act");
    }
  });

  it("permits managers to view direct reports", async () => {
    const engine = new PolicyEngine().use(enforceSelfServiceScope);
    const result = await engine.check({
      tool: "get_pto_balance",
      input: { employeeId: "emp-002" },
      context: { userId: "emp-001", roles: ["employee", "manager"] },
    });
    expect(result.allowed).toBe(true);
  });

  it("permits hr_admin to act broadly", async () => {
    const engine = new PolicyEngine().use(enforceSelfServiceScope);
    const result = await engine.check({
      tool: "get_pto_balance",
      input: { employeeId: "emp-099" },
      context: { userId: "emp-001", roles: ["hr_admin"] },
    });
    expect(result.allowed).toBe(true);
  });

  it("passes through tools with no employeeId in the input", async () => {
    const engine = new PolicyEngine().use(enforceSelfServiceScope);
    const result = await engine.check({
      tool: "list_pending_approvals",
      input: { approverId: "emp-001" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(true);
  });
});

describe("PolicyEngine — approval authority", () => {
  it("denies non-managers from deciding approvals", async () => {
    const engine = new PolicyEngine().use(enforceApprovalAuthority);
    const result = await engine.check({
      tool: "decide_approval",
      input: { requestId: "req-001", decision: "approve" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(false);
  });

  it("permits managers to decide approvals", async () => {
    const engine = new PolicyEngine().use(enforceApprovalAuthority);
    const result = await engine.check({
      tool: "decide_approval",
      input: { requestId: "req-001", decision: "approve" },
      context: { userId: "emp-001", roles: ["manager"] },
    });
    expect(result.allowed).toBe(true);
  });

  it("ignores non-approval tools", async () => {
    const engine = new PolicyEngine().use(enforceApprovalAuthority);
    const result = await engine.check({
      tool: "get_pto_balance",
      input: { employeeId: "emp-001" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(true);
  });
});

describe("PolicyEngine — enrollment window", () => {
  it("blocks enrollment outside the window", async () => {
    const past = new Date("2020-01-01");
    const longPast = new Date("2020-02-01");
    const engine = new PolicyEngine().use(
      enforceEnrollmentWindow(past, longPast)
    );
    const result = await engine.check({
      tool: "enroll_in_benefit_plan",
      input: { employeeId: "emp-001", planId: "med-ppo" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(false);
  });

  it("permits enrollment inside the window", async () => {
    const past = new Date("2020-01-01");
    const future = new Date("2099-01-01");
    const engine = new PolicyEngine().use(
      enforceEnrollmentWindow(past, future)
    );
    const result = await engine.check({
      tool: "enroll_in_benefit_plan",
      input: { employeeId: "emp-001", planId: "med-ppo" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(true);
  });

  it("ignores tools other than enroll_in_benefit_plan", async () => {
    const past = new Date("2020-01-01");
    const longPast = new Date("2020-02-01");
    const engine = new PolicyEngine().use(
      enforceEnrollmentWindow(past, longPast)
    );
    const result = await engine.check({
      tool: "list_benefit_plans",
      input: { employeeId: "emp-001" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(true);
  });
});

describe("PolicyEngine — composition", () => {
  it("first deny wins", async () => {
    const past = new Date("2020-01-01");
    const longPast = new Date("2020-02-01");
    const engine = new PolicyEngine()
      .use(enforceSelfServiceScope)
      .use(enforceEnrollmentWindow(past, longPast));
    const result = await engine.check({
      tool: "enroll_in_benefit_plan",
      input: { employeeId: "emp-002", planId: "med-ppo" },
      context: { userId: "emp-001", roles: ["employee"] },
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("cannot act");
    }
  });

  it("empty engine allows everything", async () => {
    const engine = new PolicyEngine();
    const result = await engine.check({
      tool: "anything",
      input: {},
      context: { userId: "emp-001", roles: [] },
    });
    expect(result.allowed).toBe(true);
  });
});
