// Component test (Vitest + Vue Test Utils) for VisitReportModal.vue, the owner's visit report window.
// Checks what the owner sees for the records kept during a session (off route, left home, location gaps),
// and the Prev / Next day buttons used to read the earlier days' reports.
// The walk map (MapLibre, which needs a real browser) is stubbed, and so is the walk API it loads paths from.
// Run with: pnpm test   (in the client folder)
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VisitReportModal from '../VisitReportModal.vue'
import { reportEntry } from './reportFixtures.js'

vi.mock('../../services/walkApi.js', () => ({ walkApi: { getById: vi.fn().mockResolvedValue({}) } }))

beforeAll(() => {
  // jsdom has no matchMedia; the window asks it whether it's on a phone (here: a computer)
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
})

function mountReport(dayIndex) {
  return mount(VisitReportModal, {
    props: { entry: reportEntry(), dayIndex },
    global: { stubs: { teleport: true, WalkMap: true } }
  })
}
const noteTexts = (wrapper, selector) => wrapper.findAll(selector).map((r) => r.find('.rep-note__text').text())

describe('TestSuite: VisitReportModal, a day with location records', () => {
  it('Test1: the heading names the day out of all the booked days', () => {
    expect(mountReport(1).find('h2').text()).toContain('Day 2')
    expect(mountReport(1).find('h2').text()).toContain('3')
  })

  it('Test2: "To note" lists off route, left home and the long location gap', () => {
    const warnings = noteTexts(mountReport(1), '.rep-note__row--warn')
    expect(warnings).toContain('Off route twice on evening walk · up to 70 m')
    expect(warnings).toContain('Left home, not on a walk · 28 min')
    expect(warnings).toContain('Location stopped · 25 min')
  })

  it('Test3: "Also noted" lists the deviation the owner was not told about, and the short gap', () => {
    const wrapper = mountReport(1)
    const info = noteTexts(wrapper, '.rep-note__row:not(.rep-note__row--warn)')
    expect(info).toContain('Briefly off route once, not far enough to notify you')
    expect(info).toContain('Location gap · 12 min')
  })

  it('Test4: the timeline shows the left-home and gap rows', () => {
    const flags = mountReport(1).findAll('.rep-flag').map((f) => f.text())
    expect(flags.some((t) => t.includes('Left home, not on a walk') && t.includes('Up to 380 m away. Back home at 12:58 pm'))).toBeTruthy()
    expect(flags.some((t) => t.includes('Location stopped updating · 25 min') && t.includes('Sharing resumed at 3:30 pm, at home.'))).toBeTruthy()
  })

  it('Test5: the walk with problems opens straight away and lists each time off route', async () => {
    const wrapper = mountReport(1)
    await flushPromises() // the window opens problem walks once it's on the page
    const walk = wrapper.find('.rep-walk')
    expect(walk.text()).toContain('Off route 3 times')
    const rows = walk.findAll('.rep-walk__rows li').map((li) => li.text())
    expect(rows.filter((t) => t.includes('Off route'))).toHaveLength(3)
    expect(rows.filter((t) => t.includes('You were notified'))).toHaveLength(2)
  })
})

describe('TestSuite: VisitReportModal, a normal day', () => {
  it('Test1: has nothing "To note" and the walk is on route', () => {
    const wrapper = mountReport(0)
    expect(wrapper.find('[aria-label="To note"]').exists()).toBe(false)
    expect(wrapper.find('.rep-walk').text()).toContain('On route')
  })
})

describe('TestSuite: VisitReportModal, moving between days', () => {
  it('Test1: on the latest day, Prev goes to the earlier report', async () => {
    const wrapper = mountReport(1)
    const [prev, next] = wrapper.findAll('.rep-step')
    expect(next.attributes('disabled')).toBeDefined() // no later day had a session
    await prev.trigger('click')
    expect(wrapper.emitted('change-day')).toEqual([[0]])
  })

  it('Test2: on the first day, Prev is disabled and Next names the next day', async () => {
    const wrapper = mountReport(0)
    const [prev, next] = wrapper.findAll('.rep-step')
    expect(prev.attributes('disabled')).toBeDefined()
    expect(next.text()).toContain('Day 2')
    await next.trigger('click')
    expect(wrapper.emitted('change-day')).toEqual([[1]])
  })

  it('Test3: the ✕ and the Esc key close it', async () => {
    const wrapper = mountReport(0)
    await wrapper.find('[aria-label="Close report"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(2)
    wrapper.unmount()
  })
})
