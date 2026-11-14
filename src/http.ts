import { MvolaError, MvolaNetworkError, MvolaOperation } from "./errors";

export interface HttpInit {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}

const MAX_ERROR_TEXT = 500;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/** Understands MVola's error body ({errorCode,...,errorParameters}) and the WSO2 gateway's ({fault:{...}}). */
const toMvolaError = (status: number, operation: MvolaOperation, text: string, parsed: unknown): MvolaError => {
  const body = asRecord(parsed);
  const fault = asRecord(body?.fault);
  const errorCode = typeof body?.errorCode === "string" ? body.errorCode : fault?.code != null ? String(fault.code) : undefined;
  const errorDescription =
    typeof body?.errorDescription === "string" ? body.errorDescription : typeof fault?.description === "string" ? fault.description : undefined;
  const params = Array.isArray(body?.errorParameters) ? (body.errorParameters as unknown[]) : [];
  const mm = params.map(asRecord).find((p) => p?.key === "mmErrorCode");
  const mmErrorCode = mm?.value != null ? String(mm.value) : undefined;

  const parts = [errorCode, errorDescription, mmErrorCode ? `mmErrorCode ${mmErrorCode}` : undefined].filter(Boolean);
  const detail = parts.length > 0 ? parts.join(" / ") : text.slice(0, MAX_ERROR_TEXT) || "no response body";
  return new MvolaError(`MVola ${operation} failed (HTTP ${status}): ${detail}`, { status, operation, errorCode, errorDescription, mmErrorCode });
};

/**
 * Single place where we talk to MVola: bounded by a timeout, JSON in / JSON out,
 * every failure typed (MvolaNetworkError when no HTTP answer, MvolaError otherwise).
 */
export async function request(url: string, init: HttpInit, timeoutMs: number, operation: MvolaOperation): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { method: init.method, headers: init.headers, body: init.body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (cause) {
    const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
    throw new MvolaNetworkError(timedOut ? `MVola ${operation} timed out after ${timeoutMs} ms` : `MVola ${operation} network error`, operation, { cause });
  }

  let text = "";
  try {
    text = await response.text();
  } catch (cause) {
    throw new MvolaNetworkError(`MVola ${operation}: could not read the response`, operation, { cause });
  }
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (!response.ok) throw toMvolaError(response.status, operation, text, parsed);
  return parsed;
}
