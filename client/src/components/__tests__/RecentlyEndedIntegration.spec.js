// Integration test (Vitest + Vue Test Utils): RecentlyEnded.vue with its real child components
// ReportRows.vue and ReviewCard.vue, working together on the owner's "Recently ended" list.
// Only the server is faked (GET /api/visits/recent returns one booking's report).
// Run with: pnpm test   (in the client folder)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RecentlyEnded from '../RecentlyEnded.vue'
import { visitsApi } from '../../services/api.js'
import { reportEntry } from './reportFixtures.js'

vi.mock('../../services/api.js', () => ({ visitsApi: { recent: vi.fn() }, reviewsApi: { create: vi.fn() } }))

const DAY = 24 * 60 * 60 * 1000

async function mountList(entries) {
  visitsApi.recent.mockResolvedValue({ bookings: entries })
  const wrapper = mount(RecentlyEnded, { global: { stubs: { RouterLink: true } } }) // the real ReportRows and ReviewCard
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  visitsApi.recent.mockReset()
})

describe('TestSuite: Recently ended + ReportRows + ReviewCard', () => {
  it('Test1: one row per day that had a session, newest first (day 3 had none, so it is left out)', async () => {
    const rows = (await mountList([reportEntry()])).findAll('.rr-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Day 2')
    expect(rows[1].text()).toContain('Day 1')
  })

  it('Test2: the day with location records shows its first warning and how many more', async () => {
    const rows = (await mountList([reportEntry()])).findAll('.rr-row')
    expect(rows[0].find('.rr-warn').text()).toBe('⚠ Off route +2')
    expect(rows[1].find('.rr-warn').exists()).toBe(false)
  })

  it("Test3: tapping a row asks the page to open that day's report", async () => {
    const wrapper = await mountList([reportEntry()])
    await wrapper.findAll('.rr-row')[1].trigger('click') // Day 1
    const [[opened]] = wrapper.emitted('open-report')
    expect(opened.entry.booking._id).toBe('b1')
    expect(opened.dayIndex).toBe(0)
  })

  it('Test4: a booking whose review closes within 14 days has the "closes in" chip, and the review form', async () => {
    const wrapper = await mountList([reportEntry({ reviewOpenUntil: Date.now() + 5 * DAY - 1000 })])
    expect(wrapper.text()).toContain('Review closes in 5 days')
    expect(wrapper.find('.rv form').exists()).toBe(true)
  })

  it('Test5: no bookings shows the empty message', async () => {
    const wrapper = await mountList([])
    expect(wrapper.text()).toContain('No bookings ended in the last 30 days')
    expect(wrapper.emitted('count')).toEqual([[0]])
  })
})
