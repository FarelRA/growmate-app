import handleSensorIngest from '~~/server/utils/ingestHandler'

export default defineEventHandler(async (event) => {
  return await handleSensorIngest(event)
})
