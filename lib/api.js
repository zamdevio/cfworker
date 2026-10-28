/**
 * @param {string} token
 * @param {string} method
 * @param {string} endpoint
 * @param {{ raw?: boolean }} [opts]
 */
export async function cfApi(token, method, endpoint, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "*/*",
    },
  });

  if (opts.raw) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, status: res.status, buf, headers: res.headers };
  }

  const json = await res.json();
  if (!res.ok || json.success === false) {
    const err =
      json?.errors?.map((e) => e.message).join("; ") ||
      `HTTP ${res.status}`;
    throw new Error(`Cloudflare API error: ${err}`);
  }
  return json;
}

/** @param {string} token */
export async function getUser(token) {
  return cfApi(token, "GET", "/user");
}

/** @param {string} token */
export async function listAccounts(token) {
  const json = await cfApi(token, "GET", "/accounts?per_page=100");
  return json.result || [];
}

/**
 * @param {string} token
 * @param {string} accountId
 */
export async function listWorkers(token, accountId) {
  const json = await cfApi(token, "GET", `/accounts/${accountId}/workers/scripts`);
  const result = json.result || [];
  return result
    .map((item) => {
      if (typeof item === "string") return item;
      return item.id || item.script || item.name || null;
    })
    .filter(Boolean)
    .sort();
}

/**
 * @param {string} token
 * @param {string} accountId
 * @param {string} worker
 * @returns {Promise<{ ok: boolean, status: number, buf: Buffer, headers: Headers, notFound?: boolean, message?: string }>}
 */
export async function downloadWorker(token, accountId, worker) {
  const endpoint = `/accounts/${accountId}/workers/scripts/${encodeURIComponent(worker)}`;
  const result = await cfApi(token, "GET", endpoint, { raw: true });

  if (result.ok) return result;

  let message = `HTTP ${result.status}`;
  let notFound = result.status === 404;

  try {
    const json = JSON.parse(result.buf.toString("utf8"));
    const apiMsg = json?.errors?.map((e) => e.message).join("; ");
    if (apiMsg) message = apiMsg;
    // Cloudflare often uses 404 or errors[].code for missing scripts
    if (
      result.status === 404 ||
      /not found|does not exist|could not find/i.test(message)
    ) {
      notFound = true;
    }
  } catch {
    // body wasn't JSON — keep status-based message
  }

  if (notFound) {
    message = `Worker not found: '${worker}' (account ${accountId})`;
  }

  return { ...result, notFound, message };
}
