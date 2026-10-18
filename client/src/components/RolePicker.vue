<script setup>
import { useRouter } from "vue-router";
const router = useRouter();

</script>

<template>
    <div class="container landing d-flex align-items-center py-4 py-lg-5">
        <div class="row g-4 g-lg-5 align-items-center w-100 mx-0">
            <div class="col-12 col-lg-6 text-center text-lg-start">
                <h1 class="display-5 fw-bold mb-2">Welcome to PetSociety🐾</h1>
                <p class="fs-5 text-muted mb-4">Trusted sitters for the pets you love.</p>

                <h2 class="h5 fw-semibold mb-3">Are you new here?</h2>
                <div class="row g-3 mb-4">
                    <div class="col-12 col-sm-6 col-lg-12 col-xl-6">
                        <button class="btn role-btn w-100 py-3 fs-5 text-nowrap" @click="router.push('/browse')">
                        🐶 I'm an owner
                        </button>
                    </div>
                    <div class="col-12 col-sm-6 col-lg-12 col-xl-6">
                        <button class="btn role-btn w-100 py-3 fs-5 text-nowrap" @click="router.push({ path: '/register', query: { role: 'sitter' } })">
                        🧑 I'm a sitter
                        </button>
                    </div>
                </div>

                <div class="d-flex align-items-center gap-3 text-muted small mb-3">
                    <hr class="flex-grow-1 m-0"> or <hr class="flex-grow-1 m-0">
                </div>

                <div class="login-box d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2 p-3">
                    <span class="fw-bold fs-6">Already have an account?</span>
                    <router-link to="/login" class="btn text-white px-4 fw-semibold" style="background-color:#c47756;">Log in</router-link>
                </div>
            </div>

            <div class="col-12 col-lg-6 text-center">
                <img src="../assets/img/landingPage.jpg" class="img-fluid rounded-4" alt="A dog and a cat">
            </div>
        </div>
    </div>
</template>

<style scoped>
.landing {
    min-height: 85vh;
}
.login-box {
    background: #fff;
    border: 1px solid #ead9cc;
    border-radius: 12px;
}
.role-btn {
    border: 1px solid #2b2420;
    color: #2b2420;
    background: #fff;
}
.role-btn:hover {
    background: #c47756;
    border-color: #c47756;
    color: #fff;
}
</style>