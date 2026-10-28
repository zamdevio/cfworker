import type {
  CfAccount,
  CfResponse,
  CfUser,
  CfWorkerScript,
} from "../types/cloudflare.js";

const API = "https://api.cloudflare.com/client/v4";

export async function cfApi<T>(
  token: string,
  method: string,
  endpoint: string,
): Promise<CfResponse<T>> {
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }

  if (!response.ok || (isRecord(body) && body.success === false)) {
    throw new Error(
      `Cloudflare API error: ${errorMessage(body, response.status)}`,
    );
  }

  if (!isRecord(body)) {
    throw new Error(
      `Cloudflare API error: HTTP ${response.status} returned a non-JSON body`,
    );
  }

  return body as unknown as CfResponse<T>;
}

export function getUser(token: string): Promise<CfResponse<CfUser>> {
  return cfApi<CfUser>(token, "GET", "/user");
}

export async function listAccounts(token: string): Promise<CfAccount[]> {
  const json = await cfApi<CfAccount[]>(token, "GET", "/accounts?per_page=100");
  return json.result ?? [];
}

export async function listWorkers(
  token: string,
  accountId: string,
): Promise<string[]> {
  const json = await cfApi<CfWorkerScript[]>(
    token,
    "GET",
    `/accounts/${encodeURIComponent(accountId)}/workers/scripts`,
  );
  const names: string[] = [];
  for (const item of json.result ?? []) {
    if (typeof item === "string") {
      names.push(item);
      continue;
    }
    const name = item.id || item.script || item.name;
    if (name) names.push(name);
  }
  return names.sort();
}

export interface DownloadResult {
  ok: boolean;
  status: number;
  buf: Buffer;
  notFound: boolean;
  message?: string;
}

export async function downloadWorker(
  token: string,
  accountId: string,
  worker: string,
): Promise<DownloadResult> {
  const endpoint = `/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(worker)}`;
  const response = await fetch(`${API}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "*/*",
    },
  });
  const buf = Buffer.from(await response.arrayBuffer());

  if (response.ok) {
    return { ok: true, status: response.status, buf, notFound: false };
  }

  let message = `HTTP ${response.status}`;
  let notFound = response.status === 404;
  try {
    const json = JSON.parse(buf.toString("utf8")) as {
      errors?: { message?: string }[];
    };
    const apiMessage = json.errors
      ?.map((item) => item.message)
      .filter((item): item is string => Boolean(item))
      .join("; ");
    if (apiMessage) message = apiMessage;
    if (
      response.status === 404 ||
      /not found|does not exist|could not find/i.test(message)
    ) {
      notFound = true;
    }
  } catch {
    // Body was not JSON.
  }

  if (notFound)
    message = `Worker not found: '${worker}' (account ${accountId})`;
  return { ok: false, status: response.status, buf, notFound, message };
}

function errorMessage(body: unknown, status: number): string {
  if (!isRecord(body) || !Array.isArray(body.errors)) return `HTTP ${status}`;
  const message = body.errors
    .map((item) =>
      isRecord(item) && typeof item.message === "string" ? item.message : "",
    )
    .filter((item) => item.length > 0)
    .join("; ");
  return message || `HTTP ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
