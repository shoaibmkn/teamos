// Structured application errors. API layers map these to the common error
// response shape (api-spec.md). Error codes are a closed set.

export const ErrorCodes = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'AI_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ErrorCodes)[number];

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.details = details;
  }

  toJSON(): { code: ErrorCode; message: string; details?: Record<string, unknown> } {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }
}

export function isAppError(value: unknown): value is AppError {
  if (value instanceof AppError) return true;
  // Bundlers (e.g. Next.js transpilePackages) can instantiate this module in
  // more than one graph, so a real AppError thrown in one graph fails an
  // `instanceof` check in another. Fall back to structural identification.
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { name?: unknown; code?: unknown; httpStatus?: unknown };
  return (
    v.name === 'AppError' &&
    typeof v.httpStatus === 'number' &&
    typeof v.code === 'string' &&
    (ErrorCodes as readonly string[]).includes(v.code)
  );
}

export const unauthenticated = (message = 'Authentication required.') =>
  new AppError('UNAUTHENTICATED', message);

export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError('FORBIDDEN', message);

export const validation = (message: string, details?: Record<string, unknown>) =>
  new AppError('VALIDATION_ERROR', message, details);

export const notFound = (message = 'Resource not found.') => new AppError('NOT_FOUND', message);

export const conflict = (message: string) => new AppError('CONFLICT', message);

export const aiUnavailable = (message = 'AI service is unavailable.') =>
  new AppError('AI_UNAVAILABLE', message);
