export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'APP_ERROR', statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You must be signed in to perform this action.') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource could not be found.') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'A conflicting record already exists.') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input data.') {
    super(message, 'VALIDATION_ERROR', 422);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CapabilityDisabledError extends AppError {
  constructor(capabilityKey: string) {
    super(
      `The "${capabilityKey}" capability is currently disabled for this Circle.`,
      'CAPABILITY_DISABLED',
      403
    );
    this.name = 'CapabilityDisabledError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Robust check that works reliably across module chunks, Next.js Server Components,
 * and SWC/Babel bundled boundaries.
 */
export function isCapabilityDisabledError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof CapabilityDisabledError) return true;
  const e = err as { name?: string; code?: string; message?: string };
  return (
    e.name === 'CapabilityDisabledError' ||
    e.code === 'CAPABILITY_DISABLED' ||
    (typeof e.message === 'string' &&
      (e.message.includes('capability is currently disabled') ||
        e.message.includes('CAPABILITY_DISABLED')))
  );
}
