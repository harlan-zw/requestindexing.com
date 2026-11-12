// pro-features-local re-export of the pro-saas `useCaller`. Some pro-features
// middleware imports it via this layer's auto-import resolution; this file
// keeps that path stable without duplicating logic.

export { useCaller } from '#layers/pro-saas/app/composables/useCaller'
