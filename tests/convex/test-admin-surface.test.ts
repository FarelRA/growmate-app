/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Static `api.admin.*` surface snapshot (post-consolidation).
 *
 * The pre-alpha array-returning list queries (adminOverview, adminConsole,
 * adminDevicesList, adminSupportTickets, adminProductsList,
 * adminPlantCatalogList, adminBlogPostsList, adminUsersList) are deleted:
 * every admin list is cursor-paginated, stats/recentEvents are standalone
 * queries, and the frontend (`app/composables/useAdmin.ts`) consumes only
 * the paginated shapes.
 *
 * The `argsJson` fingerprints below are the deterministic `exportArgs()`
 * serializations of each function's Convex validators. Any change to an
 * args validator (added/removed/renamed field, changed type or optionality)
 * fails this test by design — update the snapshot only alongside a
 * deliberate API change.
 */
import { describe, it, expect } from 'vitest'
import * as adminModule from '../../convex/admin'

const EXPECTED_QUERIES = [
  'adminBlogPostsPaginated',
  'adminDevicesPaginated',
  'adminPlantCatalogPaginated',
  'adminProductsPaginated',
  'adminRecentEvents',
  'adminStats',
  'adminSupportPaginated',
  'adminUsersPaginated',
].sort()

const EXPECTED_MUTATIONS = [
  'adminClearDeviceClaim',
  'adminClearDeviceOta',
  'adminDeleteDevice',
  'adminDeleteOfficialProduct',
  'adminDeletePlantPreset',
  'adminQueueDeviceCommand',
  'adminSaveDevice',
  'adminSaveOfficialProduct',
  'adminSavePlantPreset',
  'adminStageDeviceClaim',
  'adminStageDeviceConfig',
  'adminStageDeviceOta',
  'adminUpdateOfficialProductStatus',
  'adminUpdateUserAccess',
].sort()

const EMPTY_ARGS = "{\"type\":\"object\",\"value\":{}}"

const PAGINATED_ARGS = "{\"type\":\"object\",\"value\":{\"paginationOpts\":{\"fieldType\":{\"type\":\"object\",\"value\":{\"numItems\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"cursor\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"string\"},{\"type\":\"null\"}]},\"optional\":false},\"endCursor\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"string\"},{\"type\":\"null\"}]},\"optional\":true},\"id\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"maximumRowsRead\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"maximumBytesRead\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true}}},\"optional\":false}}}"

const ARGS_SNAPSHOT: Record<string, string> = {
  adminBlogPostsPaginated: PAGINATED_ARGS,
  adminRecentEvents: EMPTY_ARGS,
  adminStats: EMPTY_ARGS,
  adminDeleteDevice: "{\"type\":\"object\",\"value\":{\"deviceId\":{\"fieldType\":{\"type\":\"id\",\"tableName\":\"devices\"},\"optional\":false}}}",
  adminDeleteOfficialProduct: "{\"type\":\"object\",\"value\":{\"productId\":{\"fieldType\":{\"type\":\"id\",\"tableName\":\"products\"},\"optional\":false}}}",
  adminDeletePlantPreset: "{\"type\":\"object\",\"value\":{\"presetId\":{\"fieldType\":{\"type\":\"id\",\"tableName\":\"plantCatalog\"},\"optional\":false}}}",
  adminDevicesPaginated: PAGINATED_ARGS,
  adminPlantCatalogPaginated: PAGINATED_ARGS,
  adminProductsPaginated: PAGINATED_ARGS,
  adminSaveDevice: "{\"type\":\"object\",\"value\":{\"existingDeviceId\":{\"fieldType\":{\"type\":\"id\",\"tableName\":\"devices\"},\"optional\":true},\"deviceId\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"name\":{\"fieldType\":{\"type\":\"string\"},\"optional\":true},\"firmwareVersion\":{\"fieldType\":{\"type\":\"string\"},\"optional\":true},\"version\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"v1\"},{\"type\":\"literal\",\"value\":\"v2\"}]},\"optional\":true},\"autoWatering\":{\"fieldType\":{\"type\":\"boolean\"},\"optional\":false},\"autoLighting\":{\"fieldType\":{\"type\":\"boolean\"},\"optional\":false},\"wateringThreshold\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"wateringDuration\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"wateringCooldown\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"lightingThreshold\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"lightingHysteresis\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"autoFertilizing\":{\"fieldType\":{\"type\":\"boolean\"},\"optional\":true},\"autoPesticide\":{\"fieldType\":{\"type\":\"boolean\"},\"optional\":true},\"fertilizingThreshold\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"fertilizingDuration\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"fertilizingCooldown\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"pesticideThreshold\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"pesticideDuration\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"pesticideCooldown\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"tankCapacity\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"tankMinLevel\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"batteryCapacityAh\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"hasModem\":{\"fieldType\":{\"type\":\"boolean\"},\"optional\":true},\"hasSolarPanel\":{\"fieldType\":{\"type\":\"boolean\"},\"optional\":true}}}",
  adminSaveOfficialProduct: "{\"type\":\"object\",\"value\":{\"productId\":{\"fieldType\":{\"type\":\"id\",\"tableName\":\"products\"},\"optional\":true},\"title\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"description\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"price\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"category\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"quantityAvailable\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"priceUnit\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"imageUrl\":{\"fieldType\":{\"type\":\"string\"},\"optional\":true},\"featured\":{\"fieldType\":{\"type\":\"boolean\"},\"optional\":false},\"status\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"active\"},{\"type\":\"literal\",\"value\":\"reserved\"},{\"type\":\"literal\",\"value\":\"sold\"},{\"type\":\"literal\",\"value\":\"archived\"}]},\"optional\":false},\"shopeeUrl\":{\"fieldType\":{\"type\":\"string\"},\"optional\":true}}}",
  adminSupportPaginated: PAGINATED_ARGS,
  adminUpdateOfficialProductStatus: "{\"type\":\"object\",\"value\":{\"productId\":{\"fieldType\":{\"type\":\"id\",\"tableName\":\"products\"},\"optional\":false},\"status\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"active\"},{\"type\":\"literal\",\"value\":\"reserved\"},{\"type\":\"literal\",\"value\":\"sold\"},{\"type\":\"literal\",\"value\":\"archived\"}]},\"optional\":false}}}",
  adminUpdateUserAccess: "{\"type\":\"object\",\"value\":{\"userId\":{\"fieldType\":{\"type\":\"id\",\"tableName\":\"users\"},\"optional\":false},\"tier\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"basic\"},{\"type\":\"literal\",\"value\":\"advanced\"}]},\"optional\":true},\"role\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"grower\"},{\"type\":\"literal\",\"value\":\"company\"},{\"type\":\"literal\",\"value\":\"admin\"}]},\"optional\":true}}}",
  adminUsersPaginated: PAGINATED_ARGS,
  adminStageDeviceConfig: "{\"type\":\"object\",\"value\":{\"deviceId\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"reportIntervalSec\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false}}}",
  adminStageDeviceClaim: "{\"type\":\"object\",\"value\":{\"deviceId\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"claimDeviceId\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false}}}",
  adminClearDeviceClaim: "{\"type\":\"object\",\"value\":{\"deviceId\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false}}}",
  adminStageDeviceOta: "{\"type\":\"object\",\"value\":{\"deviceId\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"minFirmware\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"firmwareUrl\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false}}}",
  adminClearDeviceOta: "{\"type\":\"object\",\"value\":{\"deviceId\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false}}}",
  adminQueueDeviceCommand: "{\"type\":\"object\",\"value\":{\"deviceId\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"kind\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"pump\"},{\"type\":\"literal\",\"value\":\"light\"},{\"type\":\"literal\",\"value\":\"fertilizer\"},{\"type\":\"literal\",\"value\":\"pesticide\"},{\"type\":\"literal\",\"value\":\"video_start\"},{\"type\":\"literal\",\"value\":\"video_stop\"}]},\"optional\":false},\"durationMs\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"enabled\":{\"fieldType\":{\"type\":\"boolean\"},\"optional\":true},\"width\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"height\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"fps\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"quality\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"maxSec\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true}}}",
  adminSavePlantPreset: "{\"type\":\"object\",\"value\":{\"presetId\":{\"fieldType\":{\"type\":\"id\",\"tableName\":\"plantCatalog\"},\"optional\":true},\"key\":{\"fieldType\":{\"type\":\"string\"},\"optional\":true},\"name\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"species\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"growthStage\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"seed_dormancy\"},{\"type\":\"literal\",\"value\":\"germination\"},{\"type\":\"literal\",\"value\":\"seedling_development\"},{\"type\":\"literal\",\"value\":\"vegetative_growth\"},{\"type\":\"literal\",\"value\":\"flowering_reproduction\"},{\"type\":\"literal\",\"value\":\"maturity_senescence\"}]},\"optional\":false},\"description\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"location\":{\"fieldType\":{\"type\":\"string\"},\"optional\":false},\"category\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"herb\"},{\"type\":\"literal\",\"value\":\"leafy\"},{\"type\":\"literal\",\"value\":\"fruiting\"},{\"type\":\"literal\",\"value\":\"houseplant\"},{\"type\":\"literal\",\"value\":\"flower\"},{\"type\":\"literal\",\"value\":\"microgreen\"}]},\"optional\":false},\"difficulty\":{\"fieldType\":{\"type\":\"union\",\"value\":[{\"type\":\"literal\",\"value\":\"easy\"},{\"type\":\"literal\",\"value\":\"medium\"},{\"type\":\"literal\",\"value\":\"advanced\"}]},\"optional\":false},\"wateringThreshold\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"lightingThreshold\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"fertilizingThreshold\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"fertilizerCadenceDays\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"pesticideCadenceDays\":{\"fieldType\":{\"type\":\"number\"},\"optional\":true},\"nutrientNotes\":{\"fieldType\":{\"type\":\"string\"},\"optional\":true},\"sensorProfile\":{\"fieldType\":{\"type\":\"object\",\"value\":{\"soil\":{\"fieldType\":{\"type\":\"object\",\"value\":{\"min\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"max\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false}}},\"optional\":false},\"light\":{\"fieldType\":{\"type\":\"object\",\"value\":{\"min\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"max\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false}}},\"optional\":false},\"temperature\":{\"fieldType\":{\"type\":\"object\",\"value\":{\"min\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"max\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false}}},\"optional\":false},\"air\":{\"fieldType\":{\"type\":\"object\",\"value\":{\"min\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"max\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false}}},\"optional\":false},\"water\":{\"fieldType\":{\"type\":\"object\",\"value\":{\"min\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"max\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false}}},\"optional\":false}}},\"optional\":false},\"lifecycleProfile\":{\"fieldType\":{\"type\":\"object\",\"value\":{\"seedDormancyDays\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"germinationDays\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"seedlingDevelopmentDays\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"vegetativeGrowthDays\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"floweringReproductionDays\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false},\"maturitySenescenceDays\":{\"fieldType\":{\"type\":\"number\"},\"optional\":false}}},\"optional\":false},\"imageUrl\":{\"fieldType\":{\"type\":\"string\"},\"optional\":true}}}",
}

function fnOf(name: string): any {
  return (adminModule as Record<string, any>)[name]
}

describe('admin api surface snapshot (api.admin.*)', () => {
  it('exports exactly the 22 public functions — no renames, no additions, no removals', () => {
    expect(Object.keys(adminModule).sort()).toEqual([...EXPECTED_QUERIES, ...EXPECTED_MUTATIONS].sort())
  })

  it('keeps every query a query and every mutation a mutation, all public', () => {
    for (const name of EXPECTED_QUERIES) {
      const fn = fnOf(name)
      expect(fn.isQuery).toBe(true)
      expect(fn.isMutation).toBeUndefined()
      expect(fn.isPublic).toBe(true)
      expect(typeof fn._handler).toBe('function')
    }
    for (const name of EXPECTED_MUTATIONS) {
      const fn = fnOf(name)
      expect(fn.isMutation).toBe(true)
      expect(fn.isQuery).toBeUndefined()
      expect(fn.isPublic).toBe(true)
      expect(typeof fn._handler).toBe('function')
    }
  })

  it('keeps args validators byte-identical for every export', () => {
    expect(Object.keys(ARGS_SNAPSHOT).sort()).toEqual(
      [...EXPECTED_QUERIES, ...EXPECTED_MUTATIONS].sort(),
    )
    for (const [name, expected] of Object.entries(ARGS_SNAPSHOT)) {
      expect(fnOf(name).exportArgs(), `args changed for ${name}`).toBe(expected)
    }
  })

  it('spot-checks adminSavePlantPreset validators field-by-field so failures pinpoint the drift', () => {
    // Full fingerprint asserted field-by-field so failures pinpoint the drift.
    const parsed = JSON.parse(fnOf('adminSavePlantPreset').exportArgs())
    const fields = parsed.value as Record<string, any>
    expect(Object.keys(fields).sort()).toEqual(
      [
        'presetId', 'key', 'name', 'species', 'growthStage', 'description', 'location',
        'category', 'difficulty', 'wateringThreshold', 'lightingThreshold',
        'fertilizingThreshold', 'fertilizerCadenceDays', 'pesticideCadenceDays',
        'nutrientNotes', 'sensorProfile', 'lifecycleProfile', 'imageUrl',
      ].sort(),
    )
    expect(fields.presetId).toMatchObject({
      fieldType: { type: 'id', tableName: 'plantCatalog' },
      optional: true,
    })
    expect(fields.growthStage.fieldType).toMatchObject({
      type: 'union',
      value: [
        { type: 'literal', value: 'seed_dormancy' },
        { type: 'literal', value: 'germination' },
        { type: 'literal', value: 'seedling_development' },
        { type: 'literal', value: 'vegetative_growth' },
        { type: 'literal', value: 'flowering_reproduction' },
        { type: 'literal', value: 'maturity_senescence' },
      ],
    })
    expect(fields.category.fieldType.value.map((l: any) => l.value)).toEqual(
      ['herb', 'leafy', 'fruiting', 'houseplant', 'flower', 'microgreen'],
    )
    expect(fields.difficulty.fieldType.value.map((l: any) => l.value)).toEqual(
      ['easy', 'medium', 'advanced'],
    )
    expect(Object.keys(fields.sensorProfile.fieldType.value).sort()).toEqual(
      ['air', 'light', 'soil', 'temperature', 'water'],
    )
    expect(Object.keys(fields.lifecycleProfile.fieldType.value).sort()).toEqual(
      [
        'floweringReproductionDays', 'germinationDays', 'maturitySenescenceDays',
        'seedDormancyDays', 'seedlingDevelopmentDays', 'vegetativeGrowthDays',
      ].sort(),
    )
  })
})
