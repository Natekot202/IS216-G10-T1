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
  home: {type: Array, default: null},          // owner's home, [lng, lat]
  homeRadiusM: {type: Number, default: 75}     // size of the shaded "start and finish here" circle
})

const mapEl = ref(null)
let map = null   // plain variable, not a ref (keeps Vue from wrapping the map)

// Brand colours (PetSociety design system)
const CORAL = '#E8692C'
const TEAL = '#2F6F62'
const INK = '#2B2420'

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
  homeMarker ??= new maplibregl.Marker({ color: TEAL }).setLngLat(h).addTo(map)
  homeMarker.setLngLat(h)
  map.getSource('home-area')?.setData(homeArea(h))
}

onMounted(() => {
  map = new maplibregl.Map({
    // the div to draw the map into
    container: mapEl.value,
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: props.home ?? [103.8198, 1.3521],  // [lng, lat] (home, or central Singapore)
    zoom: props.home ? 16 : 11,
    maxPitch: 80,
    pitch: 60
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

    // sets up the walked path visual
    map.addSource('walked', {type : 'geojson', data: line(props.walkedPath)})
    map.addLayer({id: 'walked', type: 'line', source: 'walked',
      paint: {'line-color': CORAL, 'line-width': 3} })
  })

  showHome(props.home)
})

// moves the home and circle if home changes
watch(() => props.home, showHome)

// watch triggers callback when reactive state changes
// triggers when props.positon is updated
watch(() => props.position, (p) => {
  // stops early if there is no position or map yet
  if (!p || !map) return;
  // ??= assign only if the marker is currently null
  // creates position marker only on first reading
  marker ??= new maplibregl.Marker({ color: INK }).setLngLat(p).addTo(map);
  // moves marker to new position
  marker.setLngLat(p);
  // moves map to centre on new position, maintaining zoom
  map.easeTo({ center: p, zoom: Math.max(map.getZoom(), 16) });
})

// triggers when walkedPath is changed
// {deep : true makes watch trigger based on change WITHIN the array}
watch(() => props.walkedPath, (c) => map?.getSource('walked')?.setData(line(c)), { deep: true });

onBeforeUnmount(() => map?.remove())
</script>

<template>
    <div ref="mapEl" class="map"></div>
</template>

<style scoped>
.map {height: 100%; min-height: 400px; width: 100%; }
</style>
