export class RequestValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function assertSafeIntegerInRange(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RequestValidationError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}
