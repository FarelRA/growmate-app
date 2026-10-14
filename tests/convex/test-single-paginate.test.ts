/**
 * Platform-rule guard: Convex allows only a SINGLE .paginate() per function,
 * but the unit FakeCtx does not enforce it — so a double-paginate that is
 * green here 500s live (this exact outage killed sendAssistantMessage).
 *
 * Helpers that run multiple times inside one user function (usage recounts,
 * per-post counts, per-user device lists) must therefore never paginate;
 * their scopes are tiny and indexed, so collect() is the correct bound.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function src(relative: string): string {
  return readFileSync(join(root, relative), 'utf8')
}

describe('single-paginate platform rule', () => {
  it('multi-call helpers never paginate', () => {
    // getAssistantUsage runs twice per sendAssistantMessage (pre-check +
    // post-insert recount); getUserDevices fans out across dashboard,
    // assistant, triggers and removal; the community counters run side by
    // side in getCommunityPostView.
    for (const file of [
      'convex/assistant/quota.ts',
      'convex/helpers/devices/summaries.ts',
      'convex/community.ts',
    ]) {
      // Call syntax only (.paginate({): the comments below name the rule.
      expect(src(file), `${file} must not paginate`).not.toContain('.paginate({')
    }
  })
})
