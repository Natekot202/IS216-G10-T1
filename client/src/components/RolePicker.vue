<script setup>
import { useRouter } from "vue-router";
const router = useRouter();

</script>

<template>
    <div class="container text-center d-flex flex-column pt-5 pb-3" style="min-height: 90vh;">
        <h1 class="mb-2">Welcome to PetSociety 🐾</h1>
        <p class="text-muted mb-5">Are you a pet owner or a pet sitter?</p>

        <div class="row g-4 justify-content-center">
        <div class="col-12 col-md-5">
            <button class="btn btn-outline-dark w-100 py-4 fs-4" @click="router.push('/browse')">
            🐶 I'm an owner
            </button>
        </div>
        <div class="col-12 col-md-5">
            <button class="btn btn-outline-dark w-100 py-4 fs-4" @click="router.push('/login')">
            🧑 I'm a sitter
            </button>
        </div>
        </div>

        <div class="mt-auto">
            <img src="../assets/img/landingPage.jpg" class="img-fluid">
        </div>
    </div>
</template>