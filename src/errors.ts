export type JobsLibErrorCode = "ERROR_BAD_ARGUMENT";

export class JobsLibError extends Error {
  code: JobsLibErrorCode;

  constructor(code: JobsLibErrorCode, message: string) {
    super(message);
    this.name = "JobsLibError";
    this.code = code;
  }
}
