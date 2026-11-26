import { aiConfigured as claudeConfigured, requestPlan as requestPlanClaude, type PlanCall } from "./claude.server";
import { groqConfigured, requestPlanGroq } from "./groq.server";

/**
 * Picks the model provider for "Ask Ops Suite": Groq when GROQ_API_KEY is set (free tier),
 * otherwise Claude when ANTHROPIC_API_KEY is set. Server-only.
 */

export type { PlanCall };

export const aiConfigured = () => groqConfigured() || claudeConfigured();

export function requestPlan(question: string, context: { today: string; persona: string }): Promise<PlanCall> {
  return groqConfigured() ? requestPlanGroq(question, context) : requestPlanClaude(question, context);
}
