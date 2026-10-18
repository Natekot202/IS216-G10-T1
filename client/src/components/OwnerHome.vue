<script setup>
import { currentUser } from "../services/auth.js";
import { computed, onMounted, ref } from 'vue';
import axios from 'axios';
import SitterProfileCard from './SitterProfileCard.vue'
import StarRating from './StarRating.vue'

const URL = 'http://localhost:5000'
const sitterProfiles = ref([])
const errorMsg = ref("")
const userRating = ref(3) //initial rating value
const searchResults = computed(()=>{

})

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

function applyFilters(){

}

onMounted(()=>{
  loadSitterProfiles()
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
        <img src="../assets/img/tempProfile.jpg" 
          class="rounded-circle ms-auto" 
          style="width: 50px; height: 50px; object-fit: cover; border:1px solid #c44f1c" 
          alt="Circular Profile">
      </div>
      
      <!-- main body -->
      <div class="row gx-3">
        <!-- filters  -->
        <div class="col-md-4 mb-3">
          <div class="border p-3 shadow" style="border-radius: 10px; background-color: white;">
            <p class="text-secondary">Filters</p>
            <!-- location filter  -->
            <label for="locations" class="form-label fw-medium">Locations</label>
            <input type="text" placeholder="Select location" class="form-control mb-3" id = "locations">
            <label for="date" class="form-label fw-medium">Available date </label>
            <input type="date" placeholder="Pick date" class="form-control mb-3" id = "date">
            <!-- price filter  -->
            <label for="price" class="form-label fw-medium">Price</label>
            <input type="range" min="0" max="100" step="5" class="form-range" id="price">
            <div class="row">
              <div class="col-5">
                <div class="d-flex gap-2">
                  <p>Min:</p>
                  <input type="number" min="0" name="" id="" class="form-control">
                </div>
              </div>
              <div class="col-5 mb-3">
                <div class="d-flex gap-2">
                  <p>Max:</p>
                  <input type="number" min="0" name="" id=""class="form-control">
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
                  <input type="checkbox" name="" class="form-check-input">
                  <p class="">Dogs</p>
                  <input type="checkbox" name="" class="form-check-input">
                  <p class="">Cats</p>
                  <input type="checkbox" name="" class="form-check-input">
                  <p class="">Rabbits</p>
                </div>
              
                <div class="d-flex gap-2">
                  <label for="others" class="font-label">Others:</label>
                  <div class="col-5"><input type="text" name="" id="others"class="form-control"></div>
                </div>
              </ul>
              <label class="fw-semibold">Rating:</label>
              <StarRating v-model="userRating" :maxStars="5"></StarRating>
            </div>
            <button class="btn border border-warning rounded col-12 fw-semibold bg-light mt-3" @click="applyFilters">Apply filters</button>
          </div>
        </div>

        <!-- search body  -->
        <div class="col-md-8">
          <!-- search bar  -->
          <div class="col-12 mb-3">
            <input type="text" name="" placeholder="Search by sitter name" class="form-control">
          </div>

          
          <div class="row">
            <div class="col-6 mb-2" v-for="sitter in sitterProfiles">
              <SitterProfileCard :sitter="sitter" class="d-inline">
                <router-link :to="`/users/${sitter._id}`" class="btn border border-warning rounded col-12 fw-semibold bg-light">View Profile</router-link>
              </SitterProfileCard>
            </div>
          </div>
  
        </div>
      </div>


    </div>
  
</template>
