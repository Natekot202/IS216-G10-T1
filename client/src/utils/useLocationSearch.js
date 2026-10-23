import { ref } from 'vue'
import axios from 'axios'

export function useLocationSearch({ addressesOnly = false} = {}) {
    const locationQuery = ref("") // location field typed by user
    const locationSuggestions = ref([]) // location suggestion dropdown
    const selected = ref(null)  // location selected when pressed eg. { lat, lng, label } 
    let debounceTimer = null
    let requestId = 0

    async function fetchLocationSuggestions(q) {
        const id = ++requestId
        try {
        const res = await axios.get('https://www.onemap.gov.sg/api/common/elastic/search', {
            params: { searchVal: q, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: 1 }
        })
        if (id !== requestId) {
            return
        }
        let results = res.data.results ?? []
        if (addressesOnly) {
            results = results.filter((r) => /^\d{6}$/.test(r.POSTAL))
        }
        locationSuggestions.value = results.slice(0, 6).map((r) => {
            const hasRoad = r.ROAD_NAME && r.ROAD_NAME !== 'NIL'
            return {
            label: r.ADDRESS,
            line1: [r.BLK_NO, hasRoad ? r.ROAD_NAME : ''].filter((x) => x && x !== 'NIL').join(' ') || r.BUILDING,
            road: hasRoad ? r.ROAD_NAME : '',
            postalCode: /^\d{6}$/.test(r.POSTAL) ? r.POSTAL : '',
            lat: parseFloat(r.LATITUDE),
            lng: parseFloat(r.LONGITUDE)
            }
        })
        } catch (e) {
        console.warn('Location search failed', e)
        locationSuggestions.value = []
        }
    }

    function onLocationInput() {
    clearTimeout(debounceTimer)
    const q = locationQuery.value.trim()
    if (q === "") {            // clearing the field removes the pin
        selected.value = null
        locationSuggestions.value = []
        return
    }
    if (q.length < 3) return
    //rate limiting
    debounceTimer = setTimeout(() => fetchLocationSuggestions(q), 400)
    }

    // location selector
    function selectLocation(s) {
        const full = locationSuggestions.value.find((x) => x.label === s.label) || s
        selected.value = full
        locationQuery.value = full.label
        locationSuggestions.value = []
    }

  return { locationQuery, locationSuggestions, selected, onLocationInput, selectLocation }

}