<script lang="ts" setup>

import { useI18n } from 'vue-i18n';
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/stores/settings';

const { t } = useI18n();

const props = withDefaults(defineProps<{
    value: PageSize;
    disabled?: boolean;
}>(), {
    disabled: false,
});

const selectId = 'page-size-selector';

const emit = defineEmits<{
    (e: 'change', value: PageSize): void;
}>();

function handleChange(event: Event): void {
    if (props.disabled) 
        return;
    
    const next = Number((event.target as HTMLSelectElement).value);
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(next))
        emit('change', next as PageSize);
}

</script>

<template>
    <label class="page_size_selector" :for="selectId">
        <span class="page_size_selector_label">{{ t('pagination.pageSize') }}</span>
        
        <select class="page_size_selector_select"
            :id="selectId"
            name="pageSize"
            :value="props.value"
            :disabled="props.disabled"
            :title="t('tooltips.pageSize')"
            @change="handleChange"
        >
            <option v-for="option in PAGE_SIZE_OPTIONS" :key="option" :value="option">
                {{ option }}
            </option>
        </select>
    </label>
</template>

<style lang="scss" scoped>

.page_size_selector {
    @extend %fx_inline_center;
    gap: .5rem;

    &_label {
        color: var(--color-muted);
        font-weight: 700;
        font-size: .85rem;
    }

    &_select {
        height: 2.25rem;
        padding: 0 .5rem;
        border: 1px solid var(--color-border);
        border-radius: .4rem;
        background: var(--color-control-background);
        color: var(--color-text);
        font-weight: 700;
        cursor: pointer;

        &:hover,
        &:focus-visible {
            border-color: var(--color-accent);
            outline: none;
        }

        &:disabled {
            cursor: not-allowed;
            opacity: .55;
        }
    }
}

</style>
