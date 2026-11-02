// One location reading from the browser, for the check when a session starts.
// Gives { location: [lng, lat], accuracy } (accuracy in metres), or null if the browser can't get one
// or the sitter said no. Never fails, so the page can treat "no location" as an answer.
export function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ location: [coords.longitude, coords.latitude], accuracy: coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}
