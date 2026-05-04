export interface BenefitPlan {
  id: string;
  name: string;
  type: "medical" | "dental" | "vision" | "401k";
  monthlyCost: number;
  description: string;
}

export interface PtoBalance {
  employeeId: string;
  accruedHours: number;
  usedHours: number;
  pendingHours: number;
}

export interface ApprovalRequest {
  id: string;
  type: string;
  requesterId: string;
  approverId: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

/**
 * Narrow interface the agent depends on. Production wires in a real client
 * (Oracle HCM REST, Workday SOAP, etc.) — the agent code never imports
 * vendor SDKs directly.
 */
export interface HCMClient {
  listBenefitPlans(employeeId: string): Promise<BenefitPlan[]>;
  enrollInPlan(
    employeeId: string,
    planId: string,
    dependents: string[]
  ): Promise<{ enrollmentId: string; status: string }>;
  getPtoBalance(employeeId: string): Promise<PtoBalance>;
  requestTimeOff(
    employeeId: string,
    startDate: string,
    endDate: string,
    reason: string
  ): Promise<{ requestId: string; status: string }>;
  listPendingApprovals(approverId: string): Promise<ApprovalRequest[]>;
  decideApproval(
    requestId: string,
    decision: "approve" | "reject",
    comment: string
  ): Promise<{ requestId: string; status: string }>;
}

/**
 * Deterministic in-memory mock. Every eval run gets a fresh instance so cases
 * don't bleed state into each other.
 */
export class MockHCMClient implements HCMClient {
  private readonly plans: BenefitPlan[] = [
    {
      id: "med-hmo",
      name: "BlueShield HMO",
      type: "medical",
      monthlyCost: 180,
      description: "Network HMO with $25 copay",
    },
    {
      id: "med-ppo",
      name: "BlueShield PPO",
      type: "medical",
      monthlyCost: 320,
      description: "Flexible PPO with out-of-network coverage",
    },
    {
      id: "dental-basic",
      name: "Delta Dental Basic",
      type: "dental",
      monthlyCost: 25,
      description: "Preventive plus basic restorative",
    },
    {
      id: "vision-std",
      name: "VSP Vision",
      type: "vision",
      monthlyCost: 12,
      description: "Annual exam plus frames every 24 months",
    },
    {
      id: "401k-std",
      name: "Fidelity 401(k)",
      type: "401k",
      monthlyCost: 0,
      description: "Pre-tax retirement; up to 6% company match",
    },
  ];

  private readonly approvals: ApprovalRequest[] = [
    {
      id: "req-001",
      type: "time_off",
      requesterId: "emp-002",
      approverId: "emp-001",
      payload: {
        startDate: "2026-05-01",
        endDate: "2026-05-05",
        reason: "Family vacation",
      },
      status: "pending",
      createdAt: "2026-04-20T10:30:00Z",
    },
  ];

  async listBenefitPlans(_employeeId: string): Promise<BenefitPlan[]> {
    return this.plans;
  }

  async enrollInPlan(
    _employeeId: string,
    planId: string,
    _dependents: string[]
  ) {
    const plan = this.plans.find((p) => p.id === planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);
    return { enrollmentId: `enr-${Date.now()}`, status: "confirmed" };
  }

  async getPtoBalance(employeeId: string): Promise<PtoBalance> {
    return {
      employeeId,
      accruedHours: 120,
      usedHours: 32,
      pendingHours: 8,
    };
  }

  async requestTimeOff(
    employeeId: string,
    startDate: string,
    endDate: string,
    reason: string
  ) {
    const id = `pto-${Date.now()}`;
    this.approvals.push({
      id,
      type: "time_off",
      requesterId: employeeId,
      approverId: "emp-001",
      payload: { startDate, endDate, reason },
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return { requestId: id, status: "pending_approval" };
  }

  async listPendingApprovals(approverId: string) {
    return this.approvals.filter(
      (a) => a.approverId === approverId && a.status === "pending"
    );
  }

  async decideApproval(
    requestId: string,
    decision: "approve" | "reject",
    _comment: string
  ) {
    const req = this.approvals.find((a) => a.id === requestId);
    if (!req) throw new Error(`Approval not found: ${requestId}`);
    req.status = decision === "approve" ? "approved" : "rejected";
    return { requestId, status: req.status };
  }
}
