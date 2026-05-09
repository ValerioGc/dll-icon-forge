<script lang="ts" setup>

import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
    page: number;
    totalPages: number;
    canGoPrevious: boolean;
    canGoNext: boolean;
}>();

const emit = defineEmits<{
    (e: 'previous'): void;
    (e: 'next'): void;
}>();

function handlePrevious(): void {
    if (props.canGoPrevious) 
        emit('previous');
}

function handleNext(): void {
    if (props.canGoNext) 
        emit('next');
}

</script>

<template>
    <nav class="pagination_controls" :aria-label="t('pagination.label')">
        <button
            type="button"
            class="pagination_controls_button action_button"
            :disabled="!canGoPrevious"
            :aria-label="t('pagination.previous')"
            @click.prevent="handlePrevious"
        >
            &lsaquo;
        </button>

        <span class="pagination_controls_status">
            {{ t('pagination.status', { page: page + 1, total: totalPages }) }}
        </span>

        <button
            type="button"
            class="pagination_controls_button action_button"
            :disabled="!canGoNext"
            :aria-label="t('pagination.next')"
            @click.prevent="handleNext"
        >
            &rsaquo;
        </button>
    </nav>
</template>

<style lang="scss" scoped>

.pagination_controls {
    @extend %fx_center;
    gap: .5rem;

    &_button {
        min-width: 2.25rem;
        height: 2.25rem;
        padding: 0 .65rem;
        font-size: 1.1rem;
        font-weight: 800;
    }

    &_status {
        min-width: 7rem;
        text-align: center;
        color: var(--color-muted);
        font-weight: 700;
    }
}

</style>