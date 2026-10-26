export class ItuObsUpstreamError extends Error {
  readonly status?: number;

  constructor(message: string, options?: ErrorOptions & { status?: number }) {
    super(message, options);
    this.name = "ItuObsUpstreamError";
    this.status = options?.status;
  }
}

export class ItuBranchMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItuBranchMismatchError";
  }
}
