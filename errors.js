export class UnimplementedMethodError extends Error {
  constructor(cls, method) {
    super(`${cls} does not implement ${method}()`);
  }
}
