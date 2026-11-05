// Unit tests (Vitest) for the back-home reminder in utils/sessionTracker.js:
// during a walk, a sitter who has been back at the home for 20 minutes without ending the walk is reminded, once per walk.
// The phone's GPS and the server are replaced with fakes (vi.mock), and the clock with Vitest's fake timers,
// so the test can "wait" 20 minutes instantly. The server's side (only one notification per walk) is tested
// by Playwright in e2e/tests/edge-walk-checks.spec.js.
// Run with: pnpm test   (in the client folder)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'

// ---- fakes ----
// The GPS: tests move the sitter by setting gps.position.value
const gps = vi.hoisted(() => ({ position: null }))
vi.mock('../useGeoTracker.js', () => ({
  createGeoTracker: () => {
    gps.position = ref(null)
    return {
      position: gps.position, path: ref([]), accuracy: ref(null), reading: ref(null), error: ref(''), blocked: ref(false),
      start: vi.fn(), stop: vi.fn(), restart: vi.fn(), startRecording: vi.fn(), stopRecording: vi.fn()
    }
  }
}))
const server = vi.hoisted(() => ({ today: vi.fn(), sendLocation: vi.fn(), remindBackHome: vi.fn() }))
vi.mock('../../services/api.js', () => ({ visitsApi: { today: server.today, sendLocation: server.sendLocation } }))
vi.mock('../../services/walkApi.js', () => ({ walkApi: { remindBackHome: server.remindBackHome } }))

const HOME = [103.85, 1.2965]
const OUT = [103.85, 1.2995] // about 330 m from the home
const MINUTE = 60 * 1000

let tracker

// The sitter's session today, with a walk already under way (as after a page reload)
function sessionWithWalk(walkId = 'w1') {
  return {
    visit: { _id: 'v1', status: 'active', home: HOME },
    sharingEndsAt: Date.now() + 5 * 60 * MINUTE,
    activeWalk: { _id: walkId, mode: 'instructions' }
  }
}
async function moveTo(point) {
  gps.position.value = point
  await nextTick()
}
const wait = (minutes) => vi.advanceTimersByTimeAsync(minutes * MINUTE)

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules() // a fresh tracker for every test (it keeps its state in the module)
  server.today.mockResolvedValue({ sessions: [sessionWithWalk()] })
  server.sendLocation.mockResolvedValue({ sharing: true })
  server.remindBackHome.mockReset().mockResolvedValue({})
  tracker = await import('../sessionTracker.js')
  await tracker.resumeTracking()
  await moveTo(OUT) // out on the walk
})
afterEach(() => {
  tracker.stopTracking()
  vi.useRealTimers()
})

describe('TestSuite: back-home reminder', () => {
  it('Test1: is not sent while the sitter is still out walking', async () => {
    await wait(30)
    expect(server.remindBackHome).not.toHaveBeenCalled()
  })

  it('Test2: is not sent before 20 minutes back at the home', async () => {
    await moveTo(HOME)
    await wait(19)
    expect(server.remindBackHome).not.toHaveBeenCalled()
  })

  it('Test3: is sent once the sitter has been back for 20 minutes', async () => {
    await moveTo(HOME)
    await wait(20.5)
    expect(server.remindBackHome).toHaveBeenCalledTimes(1)
    expect(server.remindBackHome).toHaveBeenCalledWith('w1')
  })

  it('Test4: is sent only once per walk, even after going out and coming back again', async () => {
    await moveTo(HOME)
    await wait(21)
    await moveTo(OUT)
    await wait(5)
    await moveTo(HOME)
    await wait(30)
    expect(server.remindBackHome).toHaveBeenCalledTimes(1)
  })

  it('Test5: going out again before 20 minutes starts the wait again', async () => {
    await moveTo(HOME)
    await wait(15)
    await moveTo(OUT)
    await wait(1)
    await moveTo(HOME)
    await wait(15)
    expect(server.remindBackHome).not.toHaveBeenCalled()
    await wait(6)
    expect(server.remindBackHome).toHaveBeenCalledTimes(1)
  })

  it('Test6: a new walk can get its own reminder', async () => {
    await moveTo(HOME)
    await wait(21)
    tracker.endWalk()
    tracker.beginWalk({ _id: 'w2', mode: 'instructions' })
    await moveTo(OUT)
    await moveTo(HOME)
    await wait(21)
    expect(server.remindBackHome.mock.calls).toEqual([['w1'], ['w2']])
  })

  it('Test7: if the reminder could not reach the server, it is tried again', async () => {
    server.remindBackHome.mockRejectedValueOnce(new Error('offline'))
    await moveTo(HOME)
    await wait(21)
    expect(server.remindBackHome).toHaveBeenCalledTimes(2)
  })
})
