<script setup>

import { currentUser } from "../services/auth.js";
import OwnerHome from "../components/OwnerHome.vue";
import SitterHome from "../views/SitterHome.vue";

</script>

<template>
  <OwnerHome v-if="currentUser?.role === 'owner'" />
  <SitterHome v-else-if="currentUser?.role === 'sitter'" />
</template>
