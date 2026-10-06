import {
  defineEventHandler,
  createError,
  getHeader,
  getQuery,
  getRouterParam,
  readBody,
  readMultipartFormData,
  readRawBody,
} from 'h3'

globalThis.defineEventHandler = defineEventHandler
globalThis.createError = createError
globalThis.getHeader = getHeader
globalThis.getQuery = getQuery
globalThis.getRouterParam = getRouterParam
globalThis.readBody = readBody
globalThis.readMultipartFormData = readMultipartFormData
globalThis.readRawBody = readRawBody
