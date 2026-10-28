export interface UnwrappedWorker {
  isMultipart: boolean;
  script: Buffer;
  parts: Map<string, Buffer>;
}

export function unwrapWorkerPayload(buf: Buffer): UnwrappedWorker {
  const head = buf.subarray(0, Math.min(buf.length, 4096)).toString("utf8");
  const firstLine = head.split(/\r?\n/, 1)[0] ?? "";
  const looksMultipart =
    firstLine.startsWith("--") &&
    firstLine.length >= 3 &&
    /content-disposition:\s*form-data/i.test(head);

  if (!looksMultipart) {
    return {
      isMultipart: false,
      script: normalizeNewlines(buf),
      parts: new Map(),
    };
  }

  const boundary = firstLine.replace(/--$/, "").trim();
  const parts = parseMultipart(buf, boundary);
  const preferred =
    parts.get("index.js") ||
    parts.get("worker.js") ||
    parts.get("main.js") ||
    firstValue(parts);

  if (!preferred)
    throw new Error("Multipart Worker response had no script parts");

  const normalized = new Map<string, Buffer>();
  for (const [name, body] of parts)
    normalized.set(name, normalizeNewlines(body));

  return {
    isMultipart: true,
    script: normalizeNewlines(preferred),
    parts: normalized,
  };
}

function parseMultipart(
  buf: Buffer,
  boundaryLine: string,
): Map<string, Buffer> {
  const raw = buf.toString("binary");
  const boundary = boundaryLine.replace(/^--/, "");
  const chunks = raw.split(`--${boundary}`).slice(1);
  const parts = new Map<string, Buffer>();

  for (const chunk of chunks) {
    if (chunk.startsWith("--")) break;

    let body = chunk;
    if (body.startsWith("\r\n")) body = body.slice(2);
    else if (body.startsWith("\n")) body = body.slice(1);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    else if (body.endsWith("\n")) body = body.slice(0, -1);

    const headerEndCr = body.indexOf("\r\n\r\n");
    const headerEndLf = body.indexOf("\n\n");
    let headerEnd = -1;
    let sepLen = 0;
    if (
      headerEndCr !== -1 &&
      (headerEndLf === -1 || headerEndCr <= headerEndLf)
    ) {
      headerEnd = headerEndCr;
      sepLen = 4;
    } else if (headerEndLf !== -1) {
      headerEnd = headerEndLf;
      sepLen = 2;
    }
    if (headerEnd === -1) continue;

    const header = body.slice(0, headerEnd);
    let content = body.slice(headerEnd + sepLen);
    if (content.endsWith("\r\n")) content = content.slice(0, -2);
    else if (content.endsWith("\n")) content = content.slice(0, -1);

    const nameMatch =
      /content-disposition:\s*form-data;\s*name="([^"]+)"/i.exec(header);
    const name = nameMatch?.[1] || `part_${parts.size}`;
    parts.set(name, Buffer.from(content, "binary"));
  }

  return parts;
}

function normalizeNewlines(buf: Buffer): Buffer {
  return Buffer.from(
    buf.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
  );
}

function firstValue(parts: Map<string, Buffer>): Buffer | undefined {
  const iterator = parts.values().next();
  return iterator.done ? undefined : iterator.value;
}
