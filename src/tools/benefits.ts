import type { ToolHandler } from "./registry.js";
import type { HCMClient } from "../integrations/mock-hcm.js";

interface ListBenefitInput {
  employeeId: string;
}

interface EnrollInput {
  employeeId: string;
  planId: string;
  dependents?: string[];
}

export function benefitsTools(hcm: HCMClient): ToolHandler[] {
  return [
    {
      name: "list_benefit_plans",
      description:
        "List all benefits plans available to an employee for the current open enrollment period. Returns plan ID, name, type (medical/dental/vision/401k), monthly cost, and a brief description.",
      inputSchema: {
        type: "object",
        properties: {
          employeeId: {
            type: "string",
            description: "Employee identifier",
          },
        },
        required: ["employeeId"],
      },
      handler: async (input, _ctx) => {
        const i = input as ListBenefitInput;
        return hcm.listBenefitPlans(i.employeeId);
      },
    },
    {
      name: "enroll_in_benefit_plan",
      description:
        "Enroll an employee in a specific benefits plan. Destructive: only call after explicitly confirming the choice with the employee.",
      inputSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string" },
          planId: { type: "string" },
          dependents: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of dependent IDs to include",
          },
        },
        required: ["employeeId", "planId"],
      },
      handler: async (input, _ctx) => {
        const i = input as EnrollInput;
        return hcm.enrollInPlan(i.employeeId, i.planId, i.dependents ?? []);
      },
    },
  ];
}
