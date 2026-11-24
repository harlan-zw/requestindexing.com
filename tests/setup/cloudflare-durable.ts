export const env = {}

export class DurableObject {
  readonly ctx: unknown
  readonly env: unknown

  constructor(ctx: unknown, env: unknown) {
    this.ctx = ctx
    this.env = env
  }
}
