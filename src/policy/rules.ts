import type { PolicyRule } from "./engine.js";

/**
 * Self-service scope: employees can only act on their own records.
 * Managers and HR admins can act across employees.
 *
 * This rule looks for an `employeeId` field on the tool input. Tools that
 * don't take an employeeId are unaffected (the rule passes through).
 */
export const enforceSelfServiceScope: PolicyRule = ({ input, context }) => {
  const targetEmployeeId = input.employeeId as string | undefined;
  if (!targetEmployeeId) return { allowed: true };
  if (targetEmployeeId === context.userId) return { allowed: true };
  if (
    context.roles.includes("hr_admin") ||
    context.roles.includes("manager")
  ) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `User ${context.userId} cannot act on records for ${targetEmployeeId}`,
  };
};

/**
 * Approval authority: only the designated approver (or HR admins) can decide
 * a pending request. The rule fires only on decide_approval.
 */
export const enforceApprovalAuthority: PolicyRule = ({
  tool,
  context,
}) => {
  if (tool !== "decide_approval") return { allowed: true };
  if (context.roles.includes("hr_admin")) return { allowed: true };
  if (context.roles.includes("manager")) return { allowed: true };
  return {
    allowed: false,
    reason: "Only the designated approver or an HR admin can decide this request",
  };
};

/**
 * Enrollment window: blocks enroll_in_benefit_plan outside the configured
 * open enrollment dates.
 */
export function enforceEnrollmentWindow(
  start: Date,
  end: Date
): PolicyRule {
  return ({ tool }) => {
    if (tool !== "enroll_in_benefit_plan") return { allowed: true };
    const now = new Date();
    if (now < start || now > end) {
      return {
        allowed: false,
        reason: `Open enrollment window is closed (${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)})`,
      };
    }
    return { allowed: true };
  };
}
