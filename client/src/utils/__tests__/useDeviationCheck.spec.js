// Unit tests (Vitest) for utils/useDeviationCheck.js: going off route during a walk.
//   further than 25 m from the route for 3 readings in a row  -> the sitter is warned
//   further than 50 m for 3 readings in a row                 -> the owner is notified
//   back within 25 m for 3 readings in a row                  -> back on route
// The GPS is a plain ref here: each test sets it to a point and the check runs, as it does on a phone.
// Run with: pnpm test   (in the client folder)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useDeviationCheck, WARN_M, NOTIFY_M, READINGS_IN_A_ROW } from '../useDeviationCheck.js'

// A straight route going east from the home, and points a set distance north of it
const LAT = 1.2965
const ROUTE = [[103.85, LAT], [103.86, LAT]]
const METRES_PER_DEGREE = 111195
const off = (metres, i = 0) => [103.851 + i * 0.0001, LAT + metres / METRES_PER_DEGREE]

let position, handlers, check

// Sends GPS readings one at a time, letting the check run after each one
async function readings(...points) {
  for (const p of points) {
    position.value = p
    await nextTick()
  }
}
const times = (n, metres) => Array.from({ length: n }, (_, i) => off(metres, i))

beforeEach(() => {
  position = ref(null)
  handlers = { onWarning: vi.fn(), onNotify: vi.fn(), onBackOnRoute: vi.fn() }
  check = useDeviationCheck(position, ref(ROUTE), handlers)
  check.start()
})

describe('TestSuite: the thresholds', () => {
  it('Test1: are 25 m to warn, 50 m to notify, 3 readings in a row', () => {
    expect(WARN_M).toBe(25)
    expect(NOTIFY_M).toBe(50)
    expect(READINGS_IN_A_ROW).toBe(3)
  })
})

describe('TestSuite: going off route', () => {
  it('Test1: staying within 25 m never warns', async () => {
    await readings(...times(5, 10))
    expect(check.level.value).toBe('on-route')
    expect(handlers.onWarning).not.toHaveBeenCalled()
  })

  it('Test2: 3 readings past 25 m warn the sitter (but do not notify the owner)', async () => {
    await readings(...times(3, 35))
    expect(check.level.value).toBe('warning')
    expect(handlers.onWarning).toHaveBeenCalledTimes(1)
    expect(handlers.onNotify).not.toHaveBeenCalled()
    expect(check.metresOffRoute.value).toBeGreaterThan(25)
  })

  it('Test3: 2 readings past 25 m are not enough (a GPS jump is ignored)', async () => {
    await readings(off(35, 0), off(35, 1), off(5, 2), off(35, 3), off(35, 4))
    expect(check.level.value).toBe('on-route')
    expect(handlers.onWarning).not.toHaveBeenCalled()
  })

  it('Test4: 3 readings past 50 m warn and then notify the owner, once', async () => {
    await readings(...times(6, 70))
    expect(check.level.value).toBe('notified')
    expect(handlers.onWarning).toHaveBeenCalledTimes(1)
    expect(handlers.onNotify).toHaveBeenCalledTimes(1)
    expect(handlers.onNotify.mock.calls[0][1]).toBeGreaterThan(50)
  })

  it('Test5: between 25 m and 50 m the owner is never notified', async () => {
    await readings(...times(10, 40))
    expect(check.level.value).toBe('warning')
    expect(handlers.onNotify).not.toHaveBeenCalled()
  })
})

describe('TestSuite: back on route', () => {
  it('Test1: 3 readings back within 25 m end a warning, and the owner was not told', async () => {
    await readings(...times(3, 35), ...times(3, 5))
    expect(check.level.value).toBe('on-route')
    expect(handlers.onBackOnRoute).toHaveBeenCalledTimes(1)
    expect(handlers.onBackOnRoute.mock.calls[0][1]).toBe(false)
  })

  it('Test2: after the owner was notified, coming back says so (so the owner gets "back on route")', async () => {
    await readings(...times(3, 70), ...times(3, 5))
    expect(handlers.onBackOnRoute).toHaveBeenCalledTimes(1)
    expect(handlers.onBackOnRoute.mock.calls[0][1]).toBe(true)
  })

  it('Test3: going off again later counts as a new deviation', async () => {
    await readings(...times(3, 70), ...times(3, 5), ...times(3, 70))
    expect(handlers.onNotify).toHaveBeenCalledTimes(2)
  })
})

describe('TestSuite: start and stop', () => {
  it('Test1: readings after stop() are not checked', async () => {
    check.stop()
    await readings(...times(6, 70))
    expect(check.level.value).toBe('on-route')
    expect(handlers.onWarning).not.toHaveBeenCalled()
  })
})
