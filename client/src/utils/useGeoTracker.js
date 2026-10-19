import {ref, onBeforeUnmount}  from 'vue'
import {distance} from '@turf/turf'

const MAX_ACCURACY_M = 30 // skip readings less accurate than this
const MIN_STEP_M = 5 // skip tiny moves (GPS drift while standing still)

// exposes constants and bundles functions
export function useGeoTracker(){
    // declares constants
    const position = ref(null); // latest position, [lng, lat]
    const path = ref([]);       // stores every accepted point [[lng, lat], ...]
    const accuracy = ref(null); // to metres
    const tracking = ref(false)
    const error = ref('');
    let watchId = null;

    // when browser gets a new GPS reading
    // saves readings accuracy, checks accuracy, updates position, adds to path
    function onPosition(pos){

        // accuracy value higher, more inaccurate
        const {longitude, latitude, accuracy: acc} = pos.coords

        // checks accuracy
        accuracy.value = acc;
        if(acc > MAX_ACCURACY_M) return // if too inaccurate, skip it

        // create new point, assigned to ref variable
        const point = [longitude, latitude]
        position.value = point

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
    }

    // starts tracking
    // navigator is a browser global variable
    function start() {
        if (!('geolocation' in navigator)) {
            error.value = 'This browser does not support location tracking.'
            return
        }

        error.value = '';
        path.value = []
        tracking.value = true;
        watchId = navigator.geolocation.watchPosition(onPosition, onError, {
            enableHighAccuracy: true, // use GPS rather than WiFi/cell location
            maximumAge: 0,            // never reuse an old cached reading
            timeout: 15000
        })
    }

    // ends tracking
    function stop(){
        if(watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        tracking.value = false;
    }

    onBeforeUnmount(stop) // stop GPS if the user leaves the page
    
    // returns constants
    return {position, path, accuracy, tracking, error, start, stop}
}

