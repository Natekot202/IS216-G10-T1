<script setup>
import { useRouter } from "vue-router";
import FeatureCarousel from '../components/FeatureCarousel.vue'

const router = useRouter();

</script>

<template>
    <div class="container landing d-flex align-items-center py-4 py-lg-5">
        <div class="landing-bg" aria-hidden="true"></div>
        <div class="row g-4 g-lg-5 align-items-center w-100 mx-0">
            <div class="col-12 col-lg-6 text-center text-lg-start">
                <div class="landing-copy">
                    <h1 class="landing-title">Trusted sitters for the pets you love</h1>
                    <p class="landing-lead">Find a sitter in Singapore, book the days you need, and follow every visit.</p>

                    <div class="role-grid">
                        <button type="button" class="role-card role-card--primary" @click="router.push('/browse')">
                            <span class="role-card__title">Find a sitter</span>
                            <span class="role-card__sub">For pet owners</span>
                        </button>
                        <button type="button" class="role-card"
                                @click="router.push({ path: '/register', query: { role: 'sitter' } })">
                            <span class="role-card__title">Become a sitter</span>
                            <span class="role-card__sub">Set your rates and get booked</span>
                        </button>
                    </div>

                    <p class="landing-login">
                        Already have an account?
                        <router-link to="/login">Log in</router-link>
                    </p>
                </div>
            </div>
            <div class="col-12 col-lg-6">
                <FeatureCarousel/>
            </div>
        </div>
    </div>
</template>

<style scoped>
.landing {
    min-height: 85vh;
}
.landing-bg {
  background:
    linear-gradient(90deg, rgba(255, 250, 245, 0.9) 0%, rgba(255, 250, 245, 0.78) 50%, rgba(255, 250, 245, 0.6) 100%),
    url('../assets/img/landingPageMain.webp') center / cover no-repeat;
}

.landing-copy {
  max-width: 34rem;
  margin-inline: auto;
}
@media (min-width: 992px) {
  .landing-copy {
    margin-inline: 0;
  }
}

.landing-title {
  font-size: clamp(2.1rem, 4.6vw, 3.1rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  text-wrap: balance;
  color: #2b2420;
}
.landing-lead {
  margin: 0.9rem 0 1.75rem;
  font-size: 1.15rem;
  color: #5c524b;
}

.landing > .row,
.landing .row > [class*='col-'] {
  min-width: 0;
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}
.role-card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 1rem 1.15rem;
  text-align: inherit;
  border: 1px solid #2b2420;
  border-radius: 12px;
  background: rgba(255, 250, 245, 0.6);
  color: #2b2420;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background 0.2s, border-color 0.2s;
}
.role-card:hover {
  background: rgba(196, 119, 86, 0.28);
  border-color: #c47756;
}
.role-card--primary {
  background: #a85a38;
  border-color: #a85a38;
  color: #fff;
}
.role-card--primary:hover {
  background: #8f4a2c;
  border-color: #8f4a2c;
}
.role-card:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
}
.role-card__title {
  font-size: 1.1rem;
  font-weight: 700;
}
.role-card__sub {
  font-size: 0.85rem;
  opacity: 0.85;
}

.landing-login {
  margin: 1.25rem 0 0;
  color: #5c524b;
}
.landing-login a {
  color: #c44f1c;
  font-weight: 700;
}

</style>