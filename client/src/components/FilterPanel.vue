<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps({ resultCount: { type: Number, default: 0 }, activeFilters: {type:Array}, hasFilters: { type: Boolean, default: false } })
defineEmits(['clear', ])

const panelEl = ref(null)

// Bootstrap sometimes leaves its dark backdrop (and the body lock) behind after the sheet closes,
// so the page stays dimmed until another tap. Clean them up once the sheet is fully closed.
function removeLeftoverBackdrop() {
  document.querySelectorAll('.offcanvas-backdrop').forEach((el) => el.remove())
  document.body.classList.remove('modal-open')
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
}

onMounted(() => panelEl.value?.addEventListener('hidden.bs.offcanvas', removeLeftoverBackdrop))
onBeforeUnmount(() => {
  panelEl.value?.removeEventListener('hidden.bs.offcanvas', removeLeftoverBackdrop)
  removeLeftoverBackdrop()
})
</script>

<template>
  <div class="filter-wrap">
    <div ref="panelEl" class="offcanvas-md offcanvas-bottom filter-panel" tabindex="-1" id="offcanvasBottom" aria-labelledby="filterTitle">
      <div class="offcanvas-header">
        <div class="d-flex flex-column">
          <h2 class="offcanvas-title fs-5 fw-bold" id="filterTitle">Filters</h2>
          <small class="text-secondary">{{ resultCount }} sitters</small>
          <div v-if="activeFilters.length" class="d-flex flex-wrap align-items-center gap-2 mt-2">
          <button v-for="f in activeFilters" :key="f.key" type="button"
                  class="filter-chip"
                  :aria-label="`Remove filter: ${f.label}`" @click="f.clear">
            {{ f.label }} <span aria-hidden="true">✕</span>
          </button>
        </div>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" data-bs-target="#offcanvasBottom" aria-label="Close"></button>
      </div>

      <div class="offcanvas-body filter-body">
        <!-- the one "Clear all" in the panel, only when a filter is on -->
        <div class="d-flex align-items-center mb-2">
          <span class="fw-bold fs-5 d-none d-md-inline">Filters</span>
          <button v-if="hasFilters" type="button" class="plain-action ms-auto" @click="$emit('clear')">Clear all</button>
        </div>
        <slot></slot>
      </div>


    </div>
  </div>
</template>

<style scoped>
/* below md: Bootstrap's bottom sheet */
.filter-panel { --bs-offcanvas-height: 85vh; border-radius: 16px 16px 0 0; }
.filter-footer { padding: .75rem 1rem; border-top: 1px solid #dee2e6; background: #fff; }

/* phone sheet: a little smaller, with more room from the edges */
@media (max-width: 767.98px) {
  .filter-panel .offcanvas-header,
  .filter-panel .filter-body { padding-inline: 1.5rem; }
  .filter-panel .filter-body { font-size: 0.92rem; }
}

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
