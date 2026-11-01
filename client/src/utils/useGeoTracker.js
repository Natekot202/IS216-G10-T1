import {ref, onBeforeUnmount}  from 'vue'
import {distance} from '@turf/turf'

const MAX_ACCURACY_M = 30
 // skip readings less accurate than this
const MIN_STEP_M = 5 // skip tiny moves (GPS drift while standing still)

// The GPS tracker itself. The location shared with an owner uses every reading, and only the path needs accurate ones.
export function createGeoTracker(){
    // declares constants
    const position = ref(null); // latest position, [lng, lat]
    const path = ref([]);       // stores every accepted point [[lng, lat], ...]
    const accuracy = ref(null); // to metres
    const reading = ref(null);  // the latest reading of any accuracy: { location: [lng, lat], accuracy }
    const tracking = ref(false) // true while GPS is on
    const recording = ref(false) // true while points are being added to path
    const error = ref('');
    const blocked = ref(false)  // true when the user has refused location access
    let watchId = null;

    // when browser gets a new GPS reading
    // saves readings accuracy, checks accuracy, updates position, adds to path
    function onPosition(pos){
        error.value = '';
        blocked.value = false;

        // accuracy value higher, more inaccurate
        const {longitude, latitude, accuracy: acc} = pos.coords

        // assign accuracy to ref variable, checks accuracy
        accuracy.value = acc;
        reading.value = {location: [longitude, latitude], accuracy: acc}
        if(acc > MAX_ACCURACY_M) return // if too inaccurate, skip it

        // create new point, assigned to ref variable
        const point = [longitude, latitude]
        position.value = point

        // only build the path while recording
        if(!recording.value) return

        // checks against previous point
        const last = path.value.at(-1)
        // if point is too close to prev point, skip
        // distance function from turf
        if(last && distance (last,point, {units : 'metres'}) < MIN_STEP_M) return
        // if movement, save to path
        path.value.push(point)
    }

    // runs when browser cant get location
    function onError(err){
        const messages = {
            1: 'Location permission denied. Allow location access in your browser settings.',
            2: 'Location unavailable. Check that GPS is on.',
            3: 'Timed out getting your location.'
        }
        error.value = messages[err.code] ?? err.message
        blocked.value = err.code === 1
    }

    // starts GPS (shows the user's position, but doesn't record a path yet)
    // navigator is a browser global variable
    function start() {
        if (!('geolocation' in navigator)) {
            error.value = 'This browser does not support location tracking.'
            return
        }
        if (watchId !== null) return // pressing start when already recording does nothing
        
        // if location info detected and no current recording session
        error.value = '';
        tracking.value = true;
        watchId = navigator.geolocation.watchPosition(onPosition, onError, {
            enableHighAccuracy: true, // use GPS rather than WiFi/cell location
            maximumAge: 0,            // never reuse an old cached reading
            timeout: 15000            // after 15s of not receiving GPS signal
        })
    }

    // asks the browser again, which is how a location switched back on gets noticed
    function restart(){
        if(watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        start()
    }

    // ends GPS tracking
    function stop(){
        if(watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        tracking.value = false;
        recording.value = false;
    }

    // begins a recording, carrying on from `saved` if there is one, or else from the current position
    function startRecording(saved = []){
        path.value = saved.length ? saved : (position.value ? [position.value] : [])
        recording.value = true
    }

    // ends the recording; adds the final position so the path ends exactly where the user stopped
    function stopRecording(){
        recording.value = false
        if(position.value && position.value !== path.value.at(-1)) path.value.push(position.value)
    }

    // returns constants
    return {position, path, accuracy, reading, tracking, recording, error, blocked, start, restart, stop, startRecording, stopRecording}
}

// For a page that tracks only while it's open (recording a route)
export function useGeoTracker(){
    const tracker = createGeoTracker()
    onBeforeUnmount(tracker.stop) // stop GPS if the user leaves the page
    return tracker
}
