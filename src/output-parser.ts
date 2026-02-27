const MAX_STREAM_CAPTURE_CHARS = 250_000;

function appendWithLimit(current: string, chunk: string): string {
  if (!chunk) return current;
  const next = current + chunk;
  if (next.length <= MAX_STREAM_CAPTURE_CHARS) return next;

  const marker = "\n... [truncated] ...\n";
  return marker + next.slice(next.length - (MAX_STREAM_CAPTURE_CHARS - marker.length));
}

export class StreamCapture {
  private raw = "";
  private display = "";

  addRawLine(line: string): void {
    this.raw = appendWithLimit(this.raw, `${line}\n`);
  }

  addDisplayText(text: string): void {
    this.display = appendWithLimit(this.display, text);
  }

  toolStatusText(toolName: string, status: string, error?: string): string {
    if (status === "running") return `\n[tool: ${toolName}] `;
    if (status === "completed") return "done\n";
    if (status === "error") return `error: ${error || "unknown"}\n`;
    return "";
  }

  getRawOutput(): string {
    return this.raw;
  }

  getDisplayOutput(): string {
    return this.display;
  }
}
