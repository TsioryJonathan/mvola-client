import { MvolaValidationError } from "./errors";

/** Numbers are sent as given (the guide shows the local format, e.g. 0343500003). */
export function assertMsisdn(value: string, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new MvolaValidationError(`${field} must be a non-empty string`);
  return value.trim();
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

export function assertId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) throw new MvolaValidationError(`${field} must be a non-empty string`);
}
