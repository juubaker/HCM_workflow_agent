import type { ToolHandler } from "./registry.js";
import type { HCMClient } from "../integrations/mock-hcm.js";

interface ListInput {
  approverId: string;
}

interface DecideInput {
  requestId: string;
  decision: "approve" | "reject";
  comment?: string;
}

export function approvalTools(hcm: HCMClient): ToolHandler[] {
  return [
    {
      name: "list_pending_approvals",
      description:
        "List approval requests awaiting decision by a specific approver. Returns request ID, type, requester, payload, and submission timestamp.",
      inputSchema: {
        type: "object",
        properties: {
          approverId: { type: "string" },
        },
        required: ["approverId"],
      },
      handler: async (input, _ctx) => {
        const i = input as ListInput;
        return hcm.listPendingApprovals(i.approverId);
      },
    },
    {
      name: "decide_approval",
      description:
        "Approve or reject a pending request. Destructive: only call after explicitly confirming the decision with the user.",
      inputSchema: {
        type: "object",
        properties: {
          requestId: { type: "string" },
          decision: {
            type: "string",
            enum: ["approve", "reject"],
          },
          comment: { type: "string" },
        },
        required: ["requestId", "decision"],
      },
      handler: async (input, _ctx) => {
        const i = input as DecideInput;
        return hcm.decideApproval(i.requestId, i.decision, i.comment ?? "");
      },
    },
  ];
}
