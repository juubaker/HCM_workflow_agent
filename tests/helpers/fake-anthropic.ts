import type Anthropic from "@anthropic-ai/sdk";

/**
 * Test double for the Anthropic SDK. Tests enqueue responses; the orchestrator
 * dequeues them as it makes calls. Use the helpers below to build typical
 * response shapes (text reply, tool call, etc.).
 */
export class FakeAnthropicClient {
  private queue: Array<Partial<Anthropic.Message>> = [];
  public calls: Anthropic.MessageCreateParams[] = [];

  enqueue(response: Partial<Anthropic.Message>): this {
    this.queue.push(response);
    return this;
  }

  messages = {
    create: async (
      params: Anthropic.MessageCreateParams
    ): Promise<Anthropic.Message> => {
      this.calls.push(params);
      const next = this.queue.shift();
      if (!next) {
        throw new Error(
          "FakeAnthropicClient: messages.create called but no responses queued"
        );
      }
      return {
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: typeof params.model === "string" ? params.model : "test",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
        content: [],
        stop_reason: "end_turn",
        ...next,
      } as Anthropic.Message;
    },
  };

  /** Cast back to Anthropic for passing into Orchestrator. */
  asClient(): Anthropic {
    return this as unknown as Anthropic;
  }
}

export function textResponse(
  text: string,
  usage = { input_tokens: 100, output_tokens: 50 }
): Partial<Anthropic.Message> {
  return {
    content: [{ type: "text", text, citations: null } as Anthropic.TextBlock],
    stop_reason: "end_turn",
    usage: usage as Anthropic.Usage,
  };
}

export function toolUseResponse(
  name: string,
  input: Record<string, unknown>,
  toolUseId = "tu_1",
  usage = { input_tokens: 100, output_tokens: 50 }
): Partial<Anthropic.Message> {
  return {
    content: [
      {
        type: "tool_use",
        id: toolUseId,
        name,
        input,
      } as Anthropic.ToolUseBlock,
    ],
    stop_reason: "tool_use",
    usage: usage as Anthropic.Usage,
  };
}

/**
 * High-cost response useful for testing the budget cap. Defaults to a usage
 * level that on its own should exceed a $0.01 budget at the model's rates.
 */
export function expensiveTextResponse(
  text: string
): Partial<Anthropic.Message> {
  return textResponse(text, { input_tokens: 1_000_000, output_tokens: 1_000_000 });
}
