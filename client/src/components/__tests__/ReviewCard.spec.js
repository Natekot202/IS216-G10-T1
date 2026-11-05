// Component test (Vitest + Vue Test Utils) for ReviewCard.vue: the owner's review of a sitter.
// Reviews close 30 days after the booking's last booked time. The card shows the form until then,
// and the closing date after. The server checks the limit too (e2e/tests/edge-payments-reviews.spec.js).
// Run with: pnpm test   (in the client folder)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ReviewCard from '../ReviewCard.vue'
import { reviewsApi } from '../../services/api.js'

vi.mock('../../services/api.js', () => ({ reviewsApi: { create: vi.fn() } }))

const DAY = 24 * 60 * 60 * 1000
const card = (props) => mount(ReviewCard, { props: { bookingId: 'b1', sitterName: 'SeedSitter', ...props } })

beforeEach(() => {
  reviewsApi.create.mockReset()
})

describe('TestSuite: ReviewCard', () => {
  it('Test1: while reviews are open, the star form shows', () => {
    const wrapper = card({ openUntil: Date.now() + 5 * DAY })
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(5)
  })

  it('Test2: after the closing date, there is no form, only the date it closed', () => {
    const closedOn = new Date('2026-10-05T12:00:00+08:00').getTime()
    const wrapper = card({ openUntil: closedOn })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('Reviews for this booking closed on 5 Oct.')
  })

  it('Test3: a posted review shows its stars, even after the closing date', () => {
    const wrapper = card({ openUntil: Date.now() - DAY, review: { rating: 4, comment: 'Great walk' } })
    expect(wrapper.find('[aria-label="4 out of 5 stars"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Great walk')
    expect(wrapper.text()).not.toContain('closed on')
  })

  it('Test4: if the server refuses (e.g. it closed while the page was open), its message is shown', async () => {
    reviewsApi.create.mockRejectedValue({ response: { data: { message: 'Reviews close 30 days after a booking ends, so this booking can no longer be reviewed.' } } })
    const wrapper = card({ openUntil: Date.now() + DAY })
    await wrapper.find('[data-star="5"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('this booking can no longer be reviewed')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})
