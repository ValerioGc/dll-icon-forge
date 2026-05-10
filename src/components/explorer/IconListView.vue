<script lang="ts" setup>

import closeIcon from '@/assets/icons/actions/close.svg';
import type { ProjectIcon } from '@/types/Project';

defineOptions({
    name: 'IconListView',
});

const props = withDefaults(defineProps<{
    items?: ProjectIcon[];
    selectedIds?: string[];
    startIndex?: number;
    disabled?: boolean;
}>(), {
    items: () => [],
    selectedIds: () => [],
    startIndex: 0,
    disabled: false,
});

const emit = defineEmits<{
    (e: 'select', id: string, additive: boolean): void;
    (e: 'delete', id: string): void;
}>();

function isSelected(id: string): boolean {
    return props.selectedIds.includes(id);
}

function handleSelect(id: string, event: MouseEvent): void {
    if (props.disabled)
        return;
    
    emit('select', id, event.ctrlKey || event.metaKey);
}

</script>

<template>
    <ul class="icon_list_view" :class="{ 'is-disabled': disabled }">
        <li v-for="(item, index) in items"
            :key="item.id"
            class="icon_list_view__item"
            :class="{
                'is-selected': isSelected(item.id),
                'is-error': item.status === 'error',
            }"
        >
            <button type="button" class="icon_list_view__select"
                :disabled="disabled"
                @click="handleSelect(item.id, $event)"
            >
                <span class="icon_list_view__index" aria-hidden="true">{{ startIndex + index + 1 }}</span>
                <span class="icon_list_view__thumb">
                    <img v-if="item.preview" :src="item.preview" alt="">
                </span>
            </button>

            <button type="button" class="icon_list_view__delete action_button"
                :disabled="disabled"
                :aria-label="$t('menu.delete')"
                @click.stop="emit('delete', item.id)"
            >
                <img class="ui_icon icon_list_view__delete_icon" :src="closeIcon" alt="" aria-hidden="true">
            </button>
        </li>
    </ul>
</template>

<style lang="scss" scoped>

.is-disabled {
    opacity: .55;
    pointer-events: none;
}

.icon_list_view {
    @extend %grid_stack;
    list-style: none;
    margin: 0;
    padding: .75rem;
    gap: .6rem;

    &__item {
        @extend %grid_stack;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: .5rem;
        border: 1px solid var(--color-border);
        border-radius: .5rem;
        background: var(--color-control-background);

        &.is-selected {
            border-color: var(--color-accent);
            box-shadow: 0 0 0 3px var(--color-accent-soft);
        }

        &.is-error {
            border-color: var(--color-danger);
        }
    }

    &__select {
        @extend %fx_start_center;
        min-width: 0;
        gap: .8rem;
        padding: .65rem;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
    }

    &__index {
        min-width: 1.75rem;
        color: var(--color-muted);
        font-weight: 700;
        text-align: right;
    }

    &__thumb {
        @extend %grid_center;
        width: 3rem;
        height: 3rem;
        flex: 0 0 auto;
        border-radius: .4rem;
        background: var(--color-placeholder);
        overflow: hidden;

        img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
    }

    &__delete {
        width: 2.25rem;
        height: 2.25rem;
        margin-right: .55rem;
        padding: 0;
        color: var(--color-danger);
        font-weight: 800;

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            border-color: var(--color-danger);
        }

        &_icon {
            width: 1rem;
            height: 1rem;
        }
    }
}

</style>
