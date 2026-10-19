<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// Tell MapLibre where Vite put its worker file (it can't find it on its own)
maplibregl.setWorkerUrl(workerUrl)

const mapEl = ref(null)
let map = null   // plain variable, not a ref (keeps Vue from wrapping the map)

const props = defineProps({
  position: {type: Array, default: null},
  walkedPath: {type: Array, default: () => []}
})
let marker = null;
const line = (coords) => (
  { type: 'Feature', 
    geometry: { type: 'LineString', coordinates: coords}
  })

onMounted(() => {
  map = new maplibregl.Map({
    // the div to draw the map into
    container: mapEl.value,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [103.8198, 1.3521],  // [lng, lat] (central Singapore)
    zoom: 11,
    maxPitch: 80,
    pitch: 60
  })

  // adds zoom and compass onto map
  map.addControl(new maplibregl.NavigationControl(), 'top-right')  // zoom buttons
  // waits until map is finished loading to load own data
  map.on('load', ()=> {
    // Source: Map Data, Layer: how the data is displayed
    map.addSource('walked', {type : 'geojson', data: line(props.walkedPath)})
    map.addLayer({id: 'walked', type: 'line', source: 'walked', 
      paint: {'line-color': '#0d6efd', 'line-width': 3} })
  })
})

// watch triggers callback when reactive state changes
// triggers when props.positon is updated
watch(() => props.position, (p) => {
  // stops early if there is no position or map yet
  if (!p || !map) return;
  // ??= assign only if the marker is currently null
  // creates read marker only on first reading
  marker ??= new maplibregl.Marker({ color: '#dc3545' }).setLngLat(p).addTo(map);
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