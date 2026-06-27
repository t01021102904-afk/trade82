import { checkRateLimit } from "@/lib/rate-limit";

export class ApiValidationError extends Error {
  status = 400;
}

export function validationError(message = "Invalid request.") {
  return new ApiValidationError(message);
}

export function validationErrorResponse(error: ApiValidationError) {
  return Response.json({ error: error.message }, { status: error.status });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function readJsonObject(request: Request) {
  const value = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(value)) {
    throw validationError("Request body must be a JSON object.");
  }
  return value;
}

export function rejectUnexpectedFields(
  body: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
) {
  const unexpected = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unexpected.length) {
    throw validationError("Request contains unsupported fields.");
  }
}

export function stringField(
  body: Record<string, unknown>,
  key: string,
  options: { max: number; required?: boolean; fallback?: string | null },
) {
  const value = body[key];
  if (value === undefined || value === null) {
    if (options.required) throw validationError(`${key} is required.`);
    return options.fallback;
  }
  if (typeof value !== "string") {
    throw validationError(`${key} must be text.`);
  }
  const trimmed = value.trim();
  if (options.required && !trimmed) {
    throw validationError(`${key} is required.`);
  }
  if (trimmed.length > options.max) {
    throw validationError(`${key} is too long.`);
  }
  return trimmed;
}

export function requiredStringField(
  body: Record<string, unknown>,
  key: string,
  max: number,
) {
  return stringField(body, key, { max, required: true }) as string;
}

export function nullableStringField(
  body: Record<string, unknown>,
  key: string,
  max: number,
) {
  const value = stringField(body, key, { max, fallback: null });
  return value || null;
}

export function enumField<T extends string>(
  body: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback?: T,
) {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    throw validationError(`${key} is required.`);
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw validationError(`${key} is invalid.`);
  }
  return value as T;
}

export function idField(
  body: Record<string, unknown>,
  key: string,
  options: { required?: boolean } = {},
) {
  const value = stringField(body, key, {
    max: 128,
    required: options.required,
    fallback: null,
  });
  if (!value) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw validationError(`${key} is invalid.`);
  }
  return value;
}

export function requiredIdField(body: Record<string, unknown>, key: string) {
  const value = idField(body, key, { required: true });
  if (!value) throw validationError(`${key} is required.`);
  return value;
}

export function idParam(value: string, name = "id") {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw validationError(`${name} is invalid.`);
  }
  return trimmed;
}

export function stringArrayField(
  body: Record<string, unknown>,
  key: string,
  options: { maxItems: number; maxLength: number; fallback?: string[] },
) {
  const value = body[key];
  if (value === undefined) return options.fallback ?? [];
  if (!Array.isArray(value)) throw validationError(`${key} must be a list.`);
  if (value.length > options.maxItems) throw validationError(`${key} has too many items.`);
  return value.map((item) => {
    if (typeof item !== "string") throw validationError(`${key} contains invalid text.`);
    const trimmed = item.trim();
    if (trimmed.length > options.maxLength) throw validationError(`${key} item is too long.`);
    return trimmed;
  }).filter(Boolean);
}

export function urlField(
  body: Record<string, unknown>,
  key: string,
  options: { max: number; required?: boolean; fallback?: string | null } = {
    max: 500,
  },
) {
  const value = stringField(body, key, options);
  if (!value) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol.");
    }
    return url.toString();
  } catch {
    throw validationError(`${key} must be a valid URL.`);
  }
}

export function linkedinUrlField(
  body: Record<string, unknown>,
  key: string,
  options: { max: number; fallback?: string | null },
) {
  const value = urlField(body, key, options);
  if (!value) return value;
  const url = new URL(value);
  if (url.hostname !== "linkedin.com" && !url.hostname.endsWith(".linkedin.com")) {
    throw validationError(`${key} must be a valid LinkedIn URL.`);
  }
  return value;
}

export function numberStringField(
  body: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number; fallback?: string | null } = {},
) {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    return options.fallback ?? null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw validationError(`${key} must be a number.`);
  if (options.min !== undefined && number < options.min) throw validationError(`${key} is too small.`);
  if (options.max !== undefined && number > options.max) throw validationError(`${key} is too large.`);
  return String(number);
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function rateLimitOrResponse({
  request,
  scope,
  userId,
  limit,
  windowMs,
  message = "Too many requests. Please try again shortly.",
}: {
  request: Request;
  scope: string;
  userId?: string | null;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  const key = `${scope}:${userId || clientIp(request)}`;
  const rateLimit = checkRateLimit(key, limit, windowMs);
  if (rateLimit.allowed) return null;
  return Response.json(
    { error: message },
    {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    },
  );
}
