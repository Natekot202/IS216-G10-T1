import { computed, nextTick, ref, watch } from 'vue'

export function usePagination(items, { pageSize = 5, scrollRef = null } = {}) {
  const page = ref(1)

  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / pageSize)))

  const pageItems = computed(() => {
    const start = (page.value - 1) * pageSize
    return items.value.slice(start, start + pageSize)
  })

  watch(totalPages, (n) => {
    if (page.value > n) {
      page.value = n
    }
  })

  function reset() {
    page.value = 1
  }

  async function goPage(n) {
    page.value = Math.min(Math.max(1, n), totalPages.value)
    await nextTick()
    const el = scrollRef?.value
    if (el) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' })
    }
  }

  return { page, totalPages, pageItems, goPage, reset }
}