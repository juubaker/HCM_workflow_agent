import type { ToolHandler } from "./registry.js";
import type { HCMClient } from "../integrations/mock-hcm.js";

interface BalanceInput {
  employeeId: string;
}

interface RequestInput {
  employeeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export function timeoffTools(hcm: HCMClient): ToolHandler[] {
  return [
    {
      name: "get_pto_balance",
      description:
        "Get the current PTO balance for an employee, including accrued, used, and pending hours.",
      inputSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string" },
        },
        required: ["employeeId"],
      },
      handler: async (input, _ctx) => {
        const i = input as BalanceInput;
        return hcm.getPtoBalance(i.employeeId);
      },
    },
    {
      name: "request_time_off",
      description:
        "Submit a paid time-off request. The request is created in pending state and routed to the employee's manager for approval.",
      inputSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string" },
          startDate: {
            type: "string",
            description: "ISO 8601 date (YYYY-MM-DD)",
          },
          endDate: {
            type: "string",
            description: "ISO 8601 date (YYYY-MM-DD)",
          },
          reason: { type: "string" },
        },
        required: ["employeeId", "startDate", "endDate"],
      },
      handler: async (input, _ctx) => {
        const i = input as RequestInput;
        return hcm.requestTimeOff(
          i.employeeId,
          i.startDate,
          i.endDate,
          i.reason ?? ""
        );
      },
    },
  ];
}
