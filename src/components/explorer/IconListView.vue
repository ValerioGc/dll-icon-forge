<script lang="ts" setup>

import { ref } from 'vue';
import closeIcon from '@/assets/icons/actions/close.svg';
import type { ProjectIcon } from '@/types/icons';

defineOptions({
    name: 'IconListView',
});

const props = withDefaults(defineProps<{
    items?: ProjectIcon[];
    selectedIds?: string[];
    startIndex?: number;
    disabled?: boolean;
    sortable?: boolean;
}>(), {
    items: () => [],
    selectedIds: () => [],
    startIndex: 0,
    disabled: false,
    sortable: true,
});

const emit = defineEmits<{
    (e: 'select', id: string, additive: boolean, range: boolean): void;
    (e: 'delete', id: string): void;
    (e: 'reorder', fromId: string, toId: string): void;
}>();

const draggedId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);

function isSelected(id: string): boolean {
    return props.selectedIds.includes(id);
}

function handleSelect(id: string, event: MouseEvent): void {
    if (props.disabled) return;
    emit('select', id, event.ctrlKey || event.metaKey, event.shiftKey);
}

function handleDragStart(id: string, event: DragEvent): void {
    if (!props.sortable || props.disabled) {
        event.preventDefault();
        return;
    }
    draggedId.value = id;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
    }
}

function handleDragEnter(id: string): void {
    if (draggedId.value && draggedId.value !== id)
        dragOverId.value = id;
}

function handleDragOver(event: DragEvent): void {
    if (draggedId.value)
        event.preventDefault();
}

function handleDrop(id: string, event: DragEvent): void {
    event.preventDefault();
    if (draggedId.value && draggedId.value !== id)
        emit('reorder', draggedId.value, id);
    draggedId.value = null;
    dragOverId.value = null;
}

function handleDragEnd(): void {
    draggedId.value = null;
    dragOverId.value = null;
}

</script>

<template>
    <ul class="icon_list_view" :class="{ 'is-disabled': disabled }">
        <li v-for="(item, index) in items"
            :key="item.id"
            class="icon_list_view_item"
            :class="{
                'is-selected': isSelected(item.id),
                'is-error': item.status === 'error',
                'is-drag-over': dragOverId === item.id,
                'is-dragging': draggedId === item.id,
            }"
            :draggable="!disabled && sortable"
            @dragstart="handleDragStart(item.id, $event)"
            @dragenter="handleDragEnter(item.id)"
            @dragover="handleDragOver($event)"
            @drop="handleDrop(item.id, $event)"
            @dragend="handleDragEnd"
        >
            <button type="button" class="icon_list_view_select"
                :disabled="disabled"
                @click="handleSelect(item.id, $event)"
            >
                <span class="icon_list_view_index" aria-hidden="true">{{ startIndex + index + 1 }}</span>
                <span class="icon_list_view_thumb">
                    <img v-if="item.preview" :src="item.preview" alt="">
                </span>
            </button>

            <button type="button" class="icon_list_view_delete action_button"
                :disabled="disabled"
                :aria-label="$t('menu.delete')"
                @click.stop="emit('delete', item.id)"
            >
                <img class="ui_icon icon_list_view_delete_icon" :src="closeIcon" alt="" aria-hidden="true" />
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

    &_item {
        @extend %grid_stack;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: .5rem;
        border: 1px solid var(--color-border);
        border-radius: .5rem;
        background: var(--color-control-background);
        transition: opacity .15s ease;

        &.is-selected {
            border-color: var(--color-accent);
            box-shadow: 0 0 0 3px var(--color-accent-soft);
        }

        &.is-error {
            border-color: var(--color-danger);
        }

        &.is-dragging {
            opacity: .35;
        }

        &.is-drag-over:not(.is-dragging) {
            border-color: var(--color-accent);
            border-style: dashed;
            background: var(--color-accent-soft);
        }
    }

    &_select {
        @extend %fx_start_center;
        min-width: 0;
        gap: .8rem;
        padding: .65rem;
        border: 0;
        background: transparent;
        text-align: left;
        cursor: pointer;
    }

    &_index {
        min-width: 1.75rem;
        color: var(--color-muted);
        font-weight: 700;
        text-align: right;
    }

    &_thumb {
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

    &_delete {
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
