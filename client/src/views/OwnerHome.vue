<script setup>
import { currentUser } from "../services/auth.js";
import { computed, onMounted, ref } from 'vue';
import L from 'leaflet';
import axios from 'axios';
import SitterProfileCard from '../components/SitterProfileCard.vue'
import StarRating from '../components/StarRating.vue'
import Map from '../components/Map.vue'

const URL = 'http://localhost:5000'
const sitterProfiles = ref([])
const errorMsg = ref("")
const selectedPets = ref([])
const otherPets = ref("")

//rangebar values
const minLimit = ref(0)
const maxLimit = ref(100)
const minValue = ref(0)
const maxValue = ref(100)

//search rating
const userRating = ref(0) //initial rating value

//search sitters
const searchKey = ref("")

function filterByPets(list) {
  const targetPets = [...selectedPets.value].map((p) => p.toLowerCase().trim());
  const other = otherPets.value.toLowerCase().trim();
  if (other !== "") targetPets.push(other);
  if (targetPets.length === 0) return list;

  return list.filter((sitter) => {
    const sitterPets = (sitter.sitterProfile.petTypes ?? []).map((p) =>
      p.toLowerCase().trim()
    );
    return targetPets.every((pet) => sitterPets.includes(pet));
  });
}

function filterByRating(list) {
  if (userRating.value == 0) return list;
  return list.filter((sitter) => sitter.sitterProfile.ratingAvg == userRating.value);
}

function filterByPrice(list) {
  const min =  Number(minValue.value);
  const max =  Number(maxValue.value);
  return list.filter((s) => s.sitterProfile.petsittingRates >= min && s.sitterProfile.petsittingRates <= max);
}

function filterBySearch(list) {
  const key = searchKey.value.trim().toLowerCase();
  if (key === "") return list;
  return list.filter((sitter) => sitter.username.toLowerCase().includes(key));
}

const searchResults = computed(() => {
  let results = sittersWithDistance.value
  results = filterByPets(results);
  results = filterByRating(results);
  results = filterByPrice(results);
  results = filterBySearch(results);
  results = filterByDistance(results)
  return sortByDistance(results)
});

//yet to be implemented (calandar)
function filterByDate(results){
  return
}

function clearFilters(){
  selectedPets.value=[]
  otherPets.value=""
  minValue.value=0
  maxValue.value=100
  userRating.value=0
  locationQuery.value=""
  origin.value = null
  maxDistanceKm.value = maxDistanceLimit
}

async function loadSitterProfiles(){
  try {
    const response = await axios.get(`${URL}/api/sitters`)
    console.log(response.data)
    sitterProfiles.value = response.data
  } catch (error) {
    console.log(error)
    errorMsg.value = "Error loading data"
  }
}

// ensures that min < max for range bar
const validateMax = () => {
  if (maxValue.value < minValue.value) {
    maxValue.value = minValue.value
  }
}
const validateMin = () => {
  if (minValue.value > maxValue.value) {
    minValue.value = maxValue.value
  }
}

// styling for progress bar
const trackStyle = computed(() => {
  const range = maxLimit.value - minLimit.value
  const minPercent = ((minValue.value - minLimit.value) / range) * 100
  const maxPercent = ((maxValue.value - minLimit.value) / range) * 100
  
  return {
    background: `linear-gradient(to right, #ddd ${minPercent}%, #42b983 ${minPercent}%, #42b983 ${maxPercent}%, #ddd ${maxPercent}%)`
  }
})


// handles location queries
const locationQuery = ref("") // location field typed by user
const locationSuggestions = ref([]) // location suggestion dropdown
const origin = ref(null) // location selected when pressed eg. { lat, lng, label } 
let debounceTimer = null
let requestId = 0

// fetch location suggestions from sg 'onemap' api 
async function fetchLocationSuggestions(q) {
  const id = ++requestId
  try {
    const res = await axios.get('https://www.onemap.gov.sg/api/common/elastic/search', {
      params: { searchVal: q, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: 1 }
    })
    if (id !== requestId) return // a newer request superseded this one
    locationSuggestions.value = (res.data.results ?? []).slice(0, 6).map(r => ({
      label: r.ADDRESS,
      lat: parseFloat(r.LATITUDE),
      lng: parseFloat(r.LONGITUDE)
    }))
  } catch (e) {
    console.warn('Location search failed', e)
    locationSuggestions.value = []
  }
}

// handles location field input
function onLocationInput() {
  clearTimeout(debounceTimer)
  const q = locationQuery.value.trim()
  if (q === "") {            // clearing the field removes the pin
    origin.value = null
    locationSuggestions.value = []
    return
  }
  if (q.length < 3) return

  //rate limiting
  debounceTimer = setTimeout(() => fetchLocationSuggestions(q), 400)
}

// location selector
function selectLocation(s) {
  origin.value = { lat: s.lat, lng: s.lng, label: s.label }
  locationQuery.value = s.label
  //clear fields
  locationSuggestions.value = []
}


// handles filter by location
const userLocation = ref(null)   // { lat, lng } from GPS
const maxDistanceLimit = 30
const maxDistanceKm = ref(maxDistanceLimit)   // at the limit = "any distance"

// get current location
function locateUser() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => { userLocation.value = { lat: coords.latitude, lng: coords.longitude } },
    err => console.warn('Geolocation failed:', err.message)
  )
}

// starting point where distance is calculated
const referencePoint = computed(() => origin.value ?? userLocation.value) //starting point chosen depending on whether input field for location filled

const sittersWithDistance = computed(() => {
  //starting point
  const from = referencePoint.value
  // create a distance attribute for each sitter object
  return sitterProfiles.value.map(s => {
    let distanceKm = null
    // sitter coordinates 
    const c = s.sitterProfile?.serviceArea?.location?.coordinates
    if (from && Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]), lat = Number(c[1])   // GeoJSON order (mongodb)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        //calculate distance based on lat and lng using leaflet latlng
        distanceKm = L.latLng(from.lat, from.lng).distanceTo([lat, lng]) / 1000
      }
    }
    return { ...s, distanceKm }
  })
})

// filter function for distance
function filterByDistance(list) {
  if (!referencePoint.value || maxDistanceKm.value >= maxDistanceLimit) return list
  return list.filter(s => s.distanceKm !== null && s.distanceKm <= maxDistanceKm.value)
}

function sortByDistance(list) {
  if (!referencePoint.value) return list
  return [...list].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
}

onMounted(()=>{
  loadSitterProfiles()
  locateUser()
})
</script>

<template>
    <div class="container-fluid">
      <!-- heading -->
      <div class="d-flex justify-content-start mb-3">
        <div>
          <h1 v-if="currentUser" class="fs-4 fw-bold">Welcome back, {{ currentUser.username }}🐾</h1>
          <h1 v-else class="fs-4 fw-bold">Welcome to Pet Society🐾</h1>
          <p class="fs-6">
            A community platform for you to find a trusted sitter!
          </p>
        </div>
        <router-link to="/profile" v-if="currentUser">
          <img src="../assets/img/tempProfile.jpg"
            class="rounded-circle ms-auto"
            style="width: 50px; height: 50px; object-fit: cover; border:1px solid #c44f1c"
            alt="Circular Profile">
        </router-link>
      </div>
      <!-- main body -->
      <div class="row gx-3">
        <!-- filters  -->
        <div class="col-md-4">
          <Map :profiles="searchResults" :origin="origin" :userLocation="userLocation"></Map>
          
          <div class="border p-3 shadow" style="border-radius: 10px; background-color: white;">
            <p class="text-secondary">Filters</p>
            <!-- location filter  -->
            <label for="locations" class="form-label fw-medium">Locations</label>
            <div class="position-relative mb-3">
              <input type="text" placeholder="Select location" class="form-control" id="locations"
                    v-model="locationQuery"
                    @input="onLocationInput"
                    @keydown.enter.prevent="locationSuggestions[0] && selectLocation(locationSuggestions[0])"
                    autocomplete="off">
              <ul v-if="locationSuggestions.length" class="list-group position-absolute w-100 shadow" style="z-index:1000">
                <li v-for="s in locationSuggestions" :key="s.label"
                    class="list-group-item list-group-item-action"
                    style="cursor:pointer"
                    @click="selectLocation(s)">{{ s.label }}</li>
              </ul>
            </div>
            <!-- distance filter -->
            <label for="distance" class="form-label fw-medium">Distance</label>
            <input id="distance" type="range" class="form-range" min="1" :max="maxDistanceLimit" step="1"
                  v-model.number="maxDistanceKm" :disabled="!referencePoint">
            <small class="text-secondary d-block mb-3">
              <template v-if="!referencePoint">Allow location access or search a location to use this filter</template>
              <template v-else>
                {{ maxDistanceKm >= maxDistanceLimit ? 'Any distance' : `Within ${maxDistanceKm} km` }}
                of {{ origin ? origin.label : 'your location' }}
              </template>
            </small>
            <!-- calandar filter  -->
            <label for="date" class="form-label fw-medium">Available date </label>
            <input type="date" placeholder="Pick date" class="form-control mb-3" id = "date">
            <!-- price filter  -->
            <label for="price" class="form-label fw-medium">Price</label>
            <div class="col-12">
              <div class="range-slider-container">
                <!-- Visual track background -->
                <div class="slider-track" :style="trackStyle"></div>
                  <input
                    type="range"
                    :min="minLimit"
                    :max="maxLimit"
                    step="5"
                    v-model.number="minValue"
                    @input="validateMin"
                    class="slider slider-min"
                  />
                  <input
                    type="range"
                    :min="minLimit"
                    :max="maxLimit"
                    step="5"
                    v-model.number="maxValue"
                    @input="validateMax"
                    class="slider slider-max"
                  />
                </div>
              <div class="row">
                <div class="col-5">
                  <div class="d-flex gap-2">
                    <p>Min:</p>
                    <input type="number" :min="minLimit" :max="maxLimit" step="5" v-model.number="minValue" class="form-control" @input="validateMin">
                  </div>
                </div>
                <div class="col-5 mb-3">
                  <div class="d-flex gap-2">
                    <p>Max:</p>
                    <input type="number" :min="minLimit" :max="maxLimit" step="5" v-model.number="maxValue" class="form-control" @input="validateMax">
                  </div>
                </div>
              </div>
            </div>

            <!-- additional filters  -->
            <button class="btn btn-link" 
              type="button" 
              data-bs-toggle="collapse" 
              data-bs-target="#collapseExample" 
              aria-expanded="false" 
              aria-controls="collapseExample"
            >
            Additional filters
            </button>

            <div class="collapse" id="collapseExample">
              <label class="form-label fw-semibold">Pet services:</label>
              <ul>
                <div class="form-check">
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="dog">
                  <p>Dogs</p>
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="cat">
                  <p>Cats</p>
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="bird">
                  <p>Bird</p>
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="rabbit">
                  <p>Rabbits</p>
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="hamster">
                  <p>Hamster</p>
                </div>
              
                <div class="d-flex gap-2">
                  <label for="others" class="font-label">Others:</label>
                  <div class="col-5"><input type="text" v-model="otherPets" id="others"class="form-control"></div>
                </div>
              </ul>
              <label class="fw-semibold">Rating:</label>
              <StarRating v-model="userRating" :maxStars="5"></StarRating>
            </div>
            <button class="btn border border-warning rounded col-12 fw-semibold bg-light mt-3" @click="clearFilters">Clear filters</button>
          </div>
        </div>
        
        <!-- search body  -->
        <div class="col-md-8 order-first">
          <!-- search bar  -->
          <div class="col-12 mb-3">
            <input type="text" v-model="searchKey" placeholder="Search by sitter name" class="form-control">
          </div>

          
          <div class="row">
            <div class="col-md-6  mb-2" v-for="sitter in searchResults">
              <!-- place holder value for price  -->
              <SitterProfileCard :sitter="sitter">
                <router-link :to="`/users/${sitter._id}`" class="btn border border-warning rounded col-12 fw-semibold bg-light">View Profile</router-link>
              </SitterProfileCard>
            </div>
          </div>
        </div>
      </div>


    </div>
  
</template>

<style scoped>
.range-slider-container {
  position: relative;
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center; /* Vertically centers the tracks and thumbs */
}

/* The actual bar background */
.slider-track {
  position: absolute;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  pointer-events: none; /* Allows clicks to pass through to the inputs */
}

.slider {
  position: absolute;
  width: 100%;
  pointer-events: none;
  appearance: none;
  background: none;
  margin: 0;
}

/* Webkit browser styling (Chrome, Safari, Edge, Opera) */
.slider::-webkit-slider-thumb {
  pointer-events: auto;
  cursor: pointer;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #42b983;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* Firefox browser styling */
.slider::-moz-range-thumb {
  pointer-events: auto;
  cursor: pointer;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #42b983;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.values {
  position: absolute;
  width: 100%;
  display: flex;
  justify-content: space-between;
  top: 30px;
}
</style>