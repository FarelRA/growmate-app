import {
  defineEventHandler,
  createError,
  getHeader,
  readMultipartFormData,
  readRawBody,
} from 'h3'

globalThis.defineEventHandler = defineEventHandler
globalThis.createError = createError
globalThis.getHeader = getHeader
globalThis.readMultipartFormData = readMultipartFormData
globalThis.readRawBody = readRawBody
