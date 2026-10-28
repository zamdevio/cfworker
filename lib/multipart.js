/**
 * Cloudflare sometimes returns multi-module Workers as multipart/form-data.
 * Strip the wrapper and return the primary script body (+ optional part map).
 */

/**
 * @param {Buffer} buf
 * @returns {{ isMultipart: boolean, script: Buffer, parts: Map<string, Buffer> }}
 */
export function unwrapWorkerPayload(buf) {
  const text = buf.toString("utf8");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";

  if (!firstLine.startsWith("--") || firstLine.length < 10) {
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
    [...parts.values()][0];

  if (!preferred) {
    throw new Error("Multipart Worker response had no script parts");
  }

  return {
    isMultipart: true,
    script: normalizeNewlines(preferred),
    parts: new Map(
      [...parts.entries()].map(([name, body]) => [name, normalizeNewlines(body)]),
    ),
  };
}

/**
 * @param {Buffer} buf
 * @param {string} boundaryLine e.g. "--abc123"
 */
function parseMultipart(buf, boundaryLine) {
  const raw = buf.toString("binary");
  const boundary = boundaryLine.replace(/^--/, "");
  const delim = `--${boundary}`;
  const chunks = raw.split(delim).slice(1);
  /** @type {Map<string, Buffer>} */
  const parts = new Map();

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

    if (headerEndCr !== -1 && (headerEndLf === -1 || headerEndCr <= headerEndLf)) {
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

    const nameMatch = /Content-Disposition:\s*form-data;\s*name="([^"]+)"/i.exec(
      header,
    );
    const name = nameMatch?.[1] || `part_${parts.size}`;
    parts.set(name, Buffer.from(content, "binary"));
  }

  return parts;
}

/** @param {Buffer} buf */
function normalizeNewlines(buf) {
  return Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
}
