<script setup>
import { currentUser } from "../services/auth.js";

const form = ref({username: "", bio: ""});

</script>

<template>

<div class="container mt-5 mb-5">
    <div class="row">
        <div class="col">
            <input v-model="form.username" class="form-control mb-3" placeholder="Username" required />
        </div>
    </div>
    <div class="row">
        <textarea v-model="form.bio" class="form-control mb-3" placeholder="currentUser.bio" required />
    </div>
</div>

</template>