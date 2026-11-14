import { MvolaValidationError } from "./errors";

/** Local numbers: 10 digits starting with 0 (e.g. 0343500003). "+261 34 ..." and "261..." are normalised. */
export function normalizeMsisdn(value: string, field: string): string {
  if (typeof value !== "string") throw new MvolaValidationError(`${field} must be a string`);
  let digits = value.replace(/[\s.-]/g, "");
  if (digits.startsWith("+261")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("261") && digits.length === 12) digits = `0${digits.slice(3)}`;
  if (!/^0\d{9}$/.test(digits)) throw new MvolaValidationError(`${field} must be a Madagascar mobile number (10 digits, e.g. 0343500003)`);
  return digits;
}

/** MVola wants an amount "without decimals". */
export function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new MvolaValidationError("amount must be a positive integer (no decimals)");
}

const ALLOWED_TEXT = /[^A-Za-z0-9 ,._-]/g;

/** descriptionText: at most 50 characters, no special characters except "-", ".", "_", ",". */
export function sanitizeDescription(description: string): string {
  if (typeof description !== "string") throw new MvolaValidationError("description must be a string");
  const clean = description.replace(ALLOWED_TEXT, " ").replace(/\s+/g, " ").trim().slice(0, 50);
  if (!clean) throw new MvolaValidationError("description is empty once special characters are removed");
  return clean;
}

/** Transaction reference: strict (it is an identifier, never silently altered). */
export function assertReference(reference: string): void {
  if (typeof reference !== "string" || reference.length === 0 || reference.length > 50 || /[^A-Za-z0-9 ,._-]/.test(reference)) {
    throw new MvolaValidationError('reference must be 1-50 characters long, without special characters except "-", ".", "_", ","');
  }
}

/**
 * X-Callback-URL rules:
 *  - https (http only for localhost, for local development);
 *  - no credentials in the URL;
 *  - AT MOST ONE query parameter. MVola answers 400 "Missing field" (mmErrorCode 4001) as soon as
 *    the URL has a second one (verified on the sandbox); carry reference and signature in a single
 *    parameter, e.g. ?ref=<id>.<signature>.
 */
export function assertCallbackUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MvolaValidationError("callbackUrl is not a valid URL");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) throw new MvolaValidationError("callbackUrl must use https");
  if (url.username || url.password) throw new MvolaValidationError("callbackUrl must not contain credentials");
  if (value.length > 2048) throw new MvolaValidationError("callbackUrl is too long");
  const params = [...url.searchParams.keys()];
  if (params.length > 1) {
    throw new MvolaValidationError(
      `callbackUrl must have at most one query parameter (found ${params.length}): MVola rejects it with 400 "Missing field". Put everything in one parameter, e.g. ?ref=<id>.<signature>`,
    );
  }
}

export function assertId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) throw new MvolaValidationError(`${field} must be a non-empty string (max 100 characters)`);
}
