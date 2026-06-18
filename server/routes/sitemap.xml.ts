import { buildSitemapXml } from '../utils/sitemap'

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const xml = await buildSitemapXml(runtimeConfig.public.convexUrl)

  setHeader(event, 'content-type', 'application/xml; charset=UTF-8')
  return xml
})
