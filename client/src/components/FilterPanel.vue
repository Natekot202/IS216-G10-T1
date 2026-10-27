<script setup>
defineProps({ resultCount: { type: Number, default: 0 } })
defineEmits(['clear'])
</script>

<template>
  <div class="filter-wrap">
    <div class="offcanvas-md offcanvas-bottom filter-panel" tabindex="-1" id="offcanvasBottom" aria-labelledby="filterTitle">
      <div class="offcanvas-header">
        <h2 class="offcanvas-title fs-5 fw-bold" id="filterTitle">Filters</h2>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" data-bs-target="#offcanvasBottom" aria-label="Close"></button>
      </div>

      <div class="offcanvas-body filter-body">
        <slot></slot>
        <button type="button" class="btn border border-warning rounded col-12 fw-semibold bg-light mt-2"
                @click="$emit('clear')">Clear filters</button>
      </div>

      <div class="filter-footer d-md-none">
        <button type="button" class="btn btn-primary w-100 fw-semibold"
                data-bs-dismiss="offcanvas" data-bs-target="#offcanvasBottom">
          Show {{ resultCount }} sitters
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* below md: Bootstrap's bottom sheet */
.filter-panel { --bs-offcanvas-height: 85vh; border-radius: 16px 16px 0 0; }
.filter-footer { padding: .75rem 1rem; border-top: 1px solid #dee2e6; background: #fff; }

/* md and up: sticky card that scrolls internally */
@media (min-width: 768px) {
  .filter-wrap {
    position: sticky;
    top: 7vh;
    max-height: calc(100vh - 7vh - 1rem);
    overflow-y: auto;
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 10px;
    box-shadow: 0 .5rem 1rem rgba(0, 0, 0, .15);
  }
  .filter-panel .filter-body { display: block; padding: 1rem; overflow: visible; }
}
</style>