// Masks the password portion of mongodb:// and mongodb+srv:// connection
// strings inside arbitrary text. Driver errors occasionally embed the URI
// in their .message, and stderr from the MCP server lands in the host
// MCP-client log (e.g., Claude Desktop), so we strip the secret before
// anything is logged.
const MONGO_URI_PATTERN = /(mongodb(?:\+srv)?:\/\/[^:@\s]+):([^@\s]+)@/g;

export function redactConnectionString(text: string): string {
  return text.replace(MONGO_URI_PATTERN, '$1:***@');
}

export function redactError(error: unknown): string {
  if (error instanceof Error) {
    return redactConnectionString(error.message);
  }

  return redactConnectionString(String(error));
}
