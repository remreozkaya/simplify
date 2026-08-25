export class ItuObsUpstreamError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ItuObsUpstreamError";
  }
}

export class ItuBranchMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItuBranchMismatchError";
  }
}
