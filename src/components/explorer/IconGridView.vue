<script lang="ts" setup>
import closeIcon from '@/assets/icons/close.svg';
import type { ProjectIcon } from '@/types/Project';

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
    if (props.disabled) {
        return;
    }
    emit('select', id, event.ctrlKey || event.metaKey);
}
</script>

<template>
    <ul class="icon_grid_view" :class="{ 'is-disabled': disabled }">
        <li
            v-for="(item, index) in items"
            :key="item.id"
            class="icon_grid_view__item"
            :class="{
                'is-selected': isSelected(item.id),
                'is-error': item.status === 'error',
            }"
        >
            <button
                type="button"
                class="icon_grid_view__select"
                :disabled="disabled"
                @click="handleSelect(item.id, $event)"
            >
                <span class="icon_grid_view__thumb">
                    <img v-if="item.preview" :src="item.preview" alt="">
                </span>
                <span class="icon_grid_view__index" aria-hidden="true">{{ startIndex + index + 1 }}</span>
            </button>

            <button
                type="button"
                class="icon_grid_view__delete action_button"
                :disabled="disabled"
                :aria-label="$t('menu.delete')"
                @click.stop="emit('delete', item.id)"
            >
                <img class="ui_icon icon_grid_view__delete_icon" :src="closeIcon" alt="" aria-hidden="true">
            </button>
        </li>
    </ul>
</template>

<style lang="scss" scoped>
.icon_grid_view {
    list-style: none;
    margin: 0;
    padding: .75rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: .6rem;
}

.is-disabled {
    opacity: .55;
    pointer-events: none;
}

.icon_grid_view__item {
    position: relative;
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

.icon_grid_view__select {
    @extend %grid_stack;
    width: 100%;
    gap: .35rem;
    padding: .75rem .5rem .5rem;
    border: 0;
    background: transparent;
    cursor: pointer;
}

.icon_grid_view__thumb {
    @extend %grid_center;
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: .4rem;
    background: var(--color-placeholder);
    overflow: hidden;

    img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
}

.icon_grid_view__index {
    color: var(--color-muted);
    font-weight: 700;
    text-align: center;
}

.icon_grid_view__delete {
    position: absolute;
    top: .25rem;
    right: .25rem;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    color: var(--color-danger);

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
        border-color: var(--color-danger);
    }
}

.icon_grid_view__delete_icon {
    width: .85rem;
    height: .85rem;
}
</style>
