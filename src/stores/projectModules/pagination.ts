import { computed, ref, type Ref } from 'vue';
import type { ProjectIcon } from '@/types/icons';

export function useProjectPagination(icons: Ref<ProjectIcon[]>, pageSize: () => number) {
  const page = ref(0);

  const totalPages = computed(() => {
    return Math.max(1, Math.ceil(icons.value.length / pageSize()));
  });

  const paginatedIcons = computed(() => {
    const start = page.value * pageSize();
    return icons.value.slice(start, start + pageSize());
  });

  const canGoNext = computed(() => page.value < totalPages.value - 1);
  const canGoPrevious = computed(() => page.value > 0);
  const currentPageGlobalStart = computed(() => page.value * pageSize());

  function clampPage(): void {
    if (page.value > totalPages.value - 1)
      page.value = Math.max(0, totalPages.value - 1);
  }

  function resetPage(): void {
    page.value = 0;
  }

  function goToPage(next: number): void {
    page.value = Math.min(Math.max(0, next), totalPages.value - 1);
  }

  function goToNextPage(): void {
    if (canGoNext.value)
      page.value += 1;
  }

  function goToPreviousPage(): void {
    if (canGoPrevious.value)
      page.value -= 1;
  }

  return {
    page,
    totalPages,
    paginatedIcons,
    canGoNext,
    canGoPrevious,
    currentPageGlobalStart,
    clampPage,
    resetPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  };
}
