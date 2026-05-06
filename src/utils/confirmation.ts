import { z } from 'zod';

// Sentinel literal that must be passed explicitly to confirm a destructive
// operation (drop-collection, drop-index, delete). The value is intentionally
// long and unique so an LLM cannot pass it accidentally — the user has to see
// it in the tool description and consciously authorize the action.
export const DESTRUCTIVE_CONFIRMATION_VALUE = 'I_KNOW_THIS_IS_DESTRUCTIVE' as const;

export const destructiveConfirmationSchema = z
  .literal(DESTRUCTIVE_CONFIRMATION_VALUE)
  .describe(
    `Required confirmation literal. Must be exactly the string "${DESTRUCTIVE_CONFIRMATION_VALUE}" — any other value is rejected. The MCP host should ask the human to confirm the destructive operation before passing this literal.`,
  );
