// Looks up a Singapore postal code using OneMap (free, no API key needed).
// Returns a GeoJSON point { type: 'Point', coordinates: [lng, lat] },
// or null if OneMap doesn't recognise the postal code.
const ONEMAP_URL = 'https://www.onemap.gov.sg/api/common/elastic/search'

export async function geocodePostalCode(postalCode) {
  const params = new URLSearchParams({
    searchVal: postalCode,
    returnGeom: 'Y',       // include coordinates in the results
    getAddrDetails: 'N',   // we only need coordinates (and 'Y' asks for an API token)
    pageNum: '1'
  })

  const res = await fetch(`${ONEMAP_URL}?${params}`, {
    signal: AbortSignal.timeout(5000)   // give up after 5 seconds
  })
  if (!res.ok) throw new Error(`OneMap lookup failed (${res.status})`)

  const data = await res.json()
  const match = data.results?.[0]
  if (!match) return null

  return {
    type: 'Point',
    coordinates: [Number(match.LONGITUDE), Number(match.LATITUDE)]
  }
}
