/* eslint-disable @typescript-eslint/no-explicit-any */
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
// Test doubles: route tests use bare mock events without node.res, so the
// real header/status helpers (which write to event.node.res) cannot run.
globalThis.setResponseHeader = ((event: any, name: string, value: string) => {
  event.__headers ??= {}
  event.__headers[name] = value
}) as any
globalThis.setResponseStatus = ((event: any, code: number) => {
  event.__status = code
}) as any
