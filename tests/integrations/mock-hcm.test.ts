import { describe, it, expect } from "vitest";
import { MockHCMClient } from "../../src/integrations/mock-hcm.js";

describe("MockHCMClient", () => {
  it("lists all benefit plans", async () => {
    const hcm = new MockHCMClient();
    const plans = await hcm.listBenefitPlans("emp-001");
    expect(plans.length).toBeGreaterThanOrEqual(5);
    expect(plans.find((p) => p.id === "med-ppo")).toBeDefined();
    expect(plans.find((p) => p.id === "401k-std")).toBeDefined();
  });

  it("enrolls a known plan and returns a confirmation", async () => {
    const hcm = new MockHCMClient();
    const result = await hcm.enrollInPlan("emp-001", "med-hmo", []);
    expect(result.status).toBe("confirmed");
    expect(result.enrollmentId).toMatch(/^enr-/);
  });

  it("throws on an unknown plan", async () => {
    const hcm = new MockHCMClient();
    await expect(
      hcm.enrollInPlan("emp-001", "fake-plan", [])
    ).rejects.toThrow(/not found/);
  });

  it("returns a PTO balance for any employee", async () => {
    const hcm = new MockHCMClient();
    const balance = await hcm.getPtoBalance("emp-001");
    expect(balance.employeeId).toBe("emp-001");
    expect(balance.accruedHours).toBeGreaterThan(0);
  });

  it("creates a pending PTO request that an approver can see", async () => {
    const hcm = new MockHCMClient();
    const created = await hcm.requestTimeOff(
      "emp-002",
      "2026-06-01",
      "2026-06-05",
      "Vacation"
    );
    expect(created.status).toBe("pending_approval");

    const pending = await hcm.listPendingApprovals("emp-001");
    expect(pending.find((p) => p.id === created.requestId)).toBeDefined();
  });

  it("approves a request and removes it from the pending list", async () => {
    const hcm = new MockHCMClient();
    const decision = await hcm.decideApproval("req-001", "approve", "ok");
    expect(decision.status).toBe("approved");

    const pending = await hcm.listPendingApprovals("emp-001");
    expect(pending.find((p) => p.id === "req-001")).toBeUndefined();
  });

  it("rejects an unknown approval id", async () => {
    const hcm = new MockHCMClient();
    await expect(
      hcm.decideApproval("ghost-id", "approve", "")
    ).rejects.toThrow(/not found/);
  });
});
