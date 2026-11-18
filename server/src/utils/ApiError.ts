export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly success: boolean;

  constructor(statusCode: number, message: string) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.success = false;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

