<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { circle } from '@turf/turf'

// Tell MapLibre where Vite put its worker file (it can't find it on its own)
maplibregl.setWorkerUrl(workerUrl)

// Properties
const props = defineProps({
  position: {type: Array, default: null},
  walkedPath: {type: Array, default: () => []},
  plannedRoute: {type: Array, default: () => []}, // a saved route to show, [[lng, lat], ...]
  home: {type: Array, default: null},          // owner's home, [lng, lat]
  homeRadiusM: {type: Number, default: 75},    // size of the shaded "start and finish here" circle
  // 'pins' (default): map pins. 'dots': home as a dark square and the sitter as a blue dot (the owner's Session page)
  markers: {type: String, default: 'pins'}
})

const mapEl = ref(null)
let map = null   // plain variable, not a ref (keeps Vue from wrapping the map)

// Brand colours (PetSociety design system)
const CORAL = '#E8692C'
const TEAL = '#2F6F62'
const INK = '#2B2420'
const BLUE = '#2563EB'

// a small HTML marker for the 'dots' style: 'home' (dark square) or 'sitter' (blue dot)
function dot(kind) {
  const el = document.createElement('span')
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, kind === 'home'
    ? { width: '14px', height: '14px', background: INK, border: '2px solid #fff', borderRadius: '3px' }
    : { width: '16px', height: '16px', background: BLUE, border: '3px solid #fff', borderRadius: '50%', boxShadow: '0 0 0 1px rgba(0,0,0,.2)' })
  return el
}
const newMarker = (kind, pinColour) => new maplibregl.Marker(props.markers === 'dots' ? { element: dot(kind) } : { color: pinColour })

// wraps a list of points as a GeoJSON line
const line = (coords) => (
  { type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords}
  })

// shaded circle around home, or nothing if there's no home
const homeArea = (h) => h
  ? circle(h, props.homeRadiusM, { units: 'meters' }) 
  : { type: 'FeatureCollection', features: [] }


let marker = null;
let homeMarker = null;

// puts the home marker (and its circle) on the map
function showHome(h) {
  if (!h || !map) return
  homeMarker ??= newMarker('home', TEAL).setLngLat(h).addTo(map)
  homeMarker.setLngLat(h)
  map.getSource('home-area')?.setData(homeArea(h))
}

// zooms the map so the whole route fits on screen
function fitTo(coords) {
  if (!map || coords.length < 2) return
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new maplibregl.LngLatBounds(coords[0], coords[0])
  )
  map.fitBounds(bounds, { padding: 40 })
}

onMounted(() => {
  map = new maplibregl.Map({
    // the div to draw the map into
    container: mapEl.value,
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: props.home ?? [103.8198, 1.3521],  // [lng, lat] (home, or central Singapore)
    zoom: props.home ? 16 : 11,
    maxPitch: 80,
    pitch: 60,
    // the 'dots' maps have a key in the bottom corner, so the map credits fold into an (i) button
    ...(props.markers === 'dots' ? { attributionControl: { compact: true } } : {})
  })

  // adds zoom and compass onto map
  map.addControl(new maplibregl.NavigationControl(), 'top-right')  // zoom buttons
  
  // waits until map is finished loading to load own data
  map.on('load', ()=> {
    // Source: Map Data, Layer: how the data is displayed
    // Sets up the home visual
    map.addSource('home-area', {type: 'geojson', data: homeArea(props.home)})
    map.addLayer({id: 'home-area', type: 'fill', source: 'home-area',
      paint: {'fill-color': TEAL, 'fill-opacity': 0.12, 'fill-outline-color': TEAL} })

    // sets up the saved route visual (teal dashed), drawn under the walked path
    map.addSource('planned', {type: 'geojson', data: line(props.plannedRoute)})
    map.addLayer({id: 'planned', type: 'line', source: 'planned',
      paint: {'line-color': TEAL, 'line-width': 3, 'line-dasharray': [2, 1.5]} })

    // sets up the walked path visual
    map.addSource('walked', {type : 'geojson', data: line(props.walkedPath)})
    map.addLayer({id: 'walked', type: 'line', source: 'walked',
      paint: {'line-color': CORAL, 'line-width': 3} })

    // a walk with no route zooms to where the sitter went instead
    fitTo(props.plannedRoute.length ? props.plannedRoute : props.walkedPath)

    // compact credits start open; fold them so they don't cover the key (the (i) button opens them)
    if (props.markers === 'dots') mapEl.value.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
  })

  showHome(props.home)
  showPosition(props.position) // the position already known when the map opens

  // A map created while hidden (e.g. a session card that isn't showing yet) measures itself too small,
  // so it redraws whenever its box changes size
  resizer = new ResizeObserver(() => map?.resize())
  resizer.observe(mapEl.value)
})
let resizer = null

// moves the home and circle if home changes
watch(() => props.home, showHome)

// redraws the saved route and zooms to it when a different route is chosen
watch(() => props.plannedRoute, (c) => {
  map?.getSource('planned')?.setData(line(c))
  fitTo(c)
})

// watch triggers callback when reactive state changes
// triggers when props.positon is updated
function showPosition(p) {
  // stops early if there is no position or map yet
  if (!p || !map) return;
  // ??= assign only if the marker is currently null
  // creates position marker only on first reading
  marker ??= newMarker('sitter', INK).setLngLat(p).addTo(map);
  // moves marker to new position
  marker.setLngLat(p);
  // moves map to centre on new position, maintaining zoom
  map.easeTo({ center: p, zoom: Math.max(map.getZoom(), 16) });
}
watch(() => props.position, showPosition)

// Fits the map back to the sitter and the home (the owner's Recentre button)
function recentre() {
  const points = [props.position, props.home].filter(Boolean)
  if (points.length === 1) map?.easeTo({ center: points[0], zoom: 16 })
  else fitTo(points)
}
defineExpose({ recentre })

// triggers when walkedPath is changed
// {deep : true makes watch trigger based on change WITHIN the array}
watch(() => props.walkedPath, (c) => map?.getSource('walked')?.setData(line(c)), { deep: true });

onBeforeUnmount(() => {
  resizer?.disconnect()
  map?.remove()
})
</script>

<template>
    <div ref="mapEl" class="map"></div>
</template>

<style scoped>
.map {height: 100%; min-height: 400px; width: 100%; }
</style>
