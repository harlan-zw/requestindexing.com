import type { EventContextMap } from './utils/event-service'

type AppHooks = {
  [Name in keyof EventContextMap]: (context: EventContextMap[Name]) => void | Promise<void>
}

declare module 'nitro/types' {
  interface NitroRuntimeHooks extends AppHooks {}
}

export {}
