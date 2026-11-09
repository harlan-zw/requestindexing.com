import { defineEventHandler } from 'h3'
import { captureFirstSignupTouch } from '../utils/signup-attribution'

export default defineEventHandler(captureFirstSignupTouch)
