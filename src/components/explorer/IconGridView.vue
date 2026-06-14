<script lang="ts" setup>

import { computed, onUnmounted, ref } from 'vue';
import chevronDown from '@/assets/icons/navigation/chevron-down.svg';
import closeIcon from '@/assets/icons/actions/close.svg';
import cropIcon from '@/assets/icons/actions/scissors.svg';
import moveIcon from '@/assets/icons/actions/move.svg';
import type { ProjectIcon } from '@/types/icons';

defineOptions({
    name: 'IconGridView',
});

type PageEdgeDirection = 'previous' | 'next';

const props = withDefaults(defineProps<{
    items?: ProjectIcon[];
    selectedIds?: string[];
    startIndex?: number;
    disabled?: boolean;
    sortable?: boolean;
    totalItems?: number;
    canPagePrevious?: boolean;
    canPageNext?: boolean;
}>(), {
    items: () => [],
    selectedIds: () => [],
    startIndex: 0,
    disabled: false,
    sortable: true,
    totalItems: 0,
    canPagePrevious: false,
    canPageNext: false,
});

const emit = defineEmits<{
    (e: 'select', id: string, additive: boolean, range: boolean): void;
    (e: 'delete', id: string): void;
    (e: 'edit', id: string): void;
    (e: 'reorder', fromId: string, toId: string, insertBefore: boolean): void;
    (e: 'moveUp', id: string): void;
    (e: 'moveDown', id: string): void;
    (e: 'deselect'): void;
    (e: 'dragPageEdge', direction: PageEdgeDirection | null): void;
}>();

const PAGE_EDGE_THRESHOLD = 56;
const draggedId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);
const dragGhost = ref<{ preview: string; x: number; y: number } | null>(null);
const pageEdge = ref<PageEdgeDirection | null>(null);
const rootRef = ref<HTMLElement | null>(null);
const canReorder = computed(() => props.sortable && !props.disabled && props.totalItems > 1);
let pendingDrop: { id: string; insertBefore: boolean } | null = null;

function isSelected(id: string): boolean {
    return props.selectedIds.includes(id);
}

function handleSelect(id: string, event: MouseEvent): void {
    if (props.disabled) 
        return;
        
    emit('select', id, event.ctrlKey || event.metaKey, event.shiftKey);
}

function handlePointerDown(id: string, event: PointerEvent): void {
    if (!canReorder.value || isActionPointer(event))
        return;
    event.preventDefault();
    draggedId.value = id;
    dragOverId.value = null;
    dragGhost.value = createDragGhost(id, event);
    pendingDrop = null;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp, { once: true });
}

function handlePointerMove(event: PointerEvent): void {
    if (draggedId.value === null) return;
    event.preventDefault();
    updateDragGhost(event);
    updatePageEdge(event);

    const target = getIconItemAtPoint(event.clientX, event.clientY);
    const targetId = target?.dataset.iconId ?? null;
    if (!target || !targetId || targetId === draggedId.value) {
        dragOverId.value = null;
        pendingDrop = null;
        return;
    }

    const rect = target.getBoundingClientRect();
    dragOverId.value = targetId;
    pendingDrop = {
        id: targetId,
        insertBefore: event.clientY < rect.top + rect.height / 2,
    };
}

function handlePointerUp(): void {
    if (draggedId.value && pendingDrop)
        emit('reorder', draggedId.value, pendingDrop.id, pendingDrop.insertBefore);
    clearPointerDrag();
}

function clearPointerDrag(): void {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    draggedId.value = null;
    dragOverId.value = null;
    dragGhost.value = null;
    setPageEdge(null);
    pendingDrop = null;
}

function createDragGhost(id: string, event: PointerEvent): { preview: string; x: number; y: number } | null {
    const item = props.items.find((icon) => icon.id === id);
    if (!item?.preview)
        return null;
    return { preview: item.preview, x: event.clientX, y: event.clientY };
}

function updateDragGhost(event: PointerEvent): void {
    if (!dragGhost.value)
        return;
    dragGhost.value = {
        ...dragGhost.value,
        x: event.clientX,
        y: event.clientY,
    };
}

function getIconItemAtPoint(x: number, y: number): HTMLElement | null {
    return document.elementFromPoint(x, y)?.closest<HTMLElement>('.icon_grid_view_item') ?? null;
}

function updatePageEdge(event: PointerEvent): void {
    const direction = resolvePageEdge(event);
    const canChangePage = direction === 'previous' ? props.canPagePrevious : direction === 'next' && props.canPageNext;
    setPageEdge(canChangePage ? direction : null);
}

function resolvePageEdge(event: PointerEvent): PageEdgeDirection | null {
    const rect = rootRef.value?.getBoundingClientRect();
    if (!rect)
        return null;

    const previousDistance = Math.min(
        Math.abs(event.clientX - rect.left),
        Math.abs(event.clientY - rect.top),
    );
    const nextDistance = Math.min(
        Math.abs(rect.right - event.clientX),
        Math.abs(rect.bottom - event.clientY),
    );

    if (previousDistance > PAGE_EDGE_THRESHOLD && nextDistance > PAGE_EDGE_THRESHOLD)
        return null;
    return previousDistance < nextDistance ? 'previous' : 'next';
}

function setPageEdge(direction: PageEdgeDirection | null): void {
    if (pageEdge.value === direction)
        return;
    pageEdge.value = direction;
    emit('dragPageEdge', direction);
}

function isActionPointer(event: PointerEvent): boolean {
    if (event.pointerType === 'mouse' && event.button !== 0)
        return true;
    return event.target instanceof HTMLElement && event.target.closest('.action_button') !== null;
}

onUnmounted(clearPointerDrag);

</script>

<template>
    <ul ref="rootRef"
        class="icon_grid_view"
        :class="{
            'is-disabled': disabled,
            'is-page-edge-previous': pageEdge === 'previous',
            'is-page-edge-next': pageEdge === 'next',
        }"
        @click.self="emit('deselect')"
    >
        <li v-for="(item, index) in items" :key="item.id"
            class="icon_grid_view_item"
            :data-icon-id="item.id"
            :class="{
                'is-selected': isSelected(item.id),
                'is-error': item.status === 'error',
                'is-drag-over': dragOverId === item.id,
                'is-dragging': draggedId === item.id,
            }"
        >
            <span v-if="canReorder"
                class="icon_grid_view_handle"
                aria-hidden="true"
                :title="$t('tooltips.moveIcon')"
                @pointerdown.stop="handlePointerDown(item.id, $event)"
            >
                <img class="ui_icon icon_grid_view_handle_icon themed_icon" :src="moveIcon" alt="" aria-hidden="true" />
            </span>

            <button type="button"
                class="icon_grid_view_select"
                :disabled="disabled"
                :title="$t('tooltips.selectIcon')"
                @click="handleSelect(item.id, $event)"
            >
                <span class="icon_grid_view_thumb">
                    <span v-if="item.previewLoading" class="icon_grid_view_spinner" aria-hidden="true"></span>
                    <img v-else-if="item.preview" :src="item.preview" alt="" draggable="false" />
                </span>
                <span class="icon_grid_view_index" aria-hidden="true">{{ startIndex + index + 1 }}</span>
            </button>

            <button type="button"
                class="icon_grid_view_delete action_button"
                :disabled="disabled"
                :aria-label="$t('menu.delete')"
                :title="$t('tooltips.deleteIcon')"
                @click.stop="emit('delete', item.id)"
            >
                <img class="ui_icon icon_grid_view_delete_icon themed_icon" :src="closeIcon" alt="" aria-hidden="true" />
            </button>

            <button type="button"
                class="icon_grid_view_edit action_button"
                :disabled="disabled"
                :aria-label="$t('menu.crop')"
                :title="$t('tooltips.cropIcon')"
                @click.stop="emit('edit', item.id)"
            >
                <img class="ui_icon icon_grid_view_edit_icon themed_icon" :src="cropIcon" alt="" aria-hidden="true" />
            </button>

            <template v-if="canReorder">
                <button type="button"
                    class="icon_grid_view_order_btn icon_grid_view_order_btn--up action_button"
                    :disabled="startIndex + index === 0"
                    :aria-label="$t('menu.moveUp')"
                    :title="$t('tooltips.moveUp')"
                    @click.stop="emit('moveUp', item.id)"
                >
                    <img class="ui_icon icon_grid_view_order_icon themed_icon icon_grid_view_order_icon--up"
                        :src="chevronDown" alt="" aria-hidden="true" />
                </button>
                <button type="button"
                    class="icon_grid_view_order_btn icon_grid_view_order_btn--down action_button"
                    :disabled="startIndex + index >= totalItems - 1"
                    :aria-label="$t('menu.moveDown')"
                    :title="$t('tooltips.moveDown')"
                    @click.stop="emit('moveDown', item.id)"
                >
                    <img class="ui_icon icon_grid_view_order_icon themed_icon"
                        :src="chevronDown" alt="" aria-hidden="true" />
                </button>
            </template>
        </li>

        <li v-if="dragGhost"
            class="icon_grid_view_drag_ghost"
            :style="{
                transform: `translate3d(${dragGhost.x + 14}px, ${dragGhost.y + 14}px, 0)`,
            }"
            aria-hidden="true"
        >
            <img :src="dragGhost.preview" alt="" draggable="false" />
        </li>
    </ul>
</template>

<style lang="scss" scoped>

.is-disabled {
    opacity: .55;
    pointer-events: none;
}

.icon_grid_view {
    position: relative;
    list-style: none;
    margin: 0;
    padding: .75rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: .6rem;

    &_item {
        position: relative;
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
            cursor: grabbing;
        }

        &.is-drag-over:not(.is-dragging) {
            border-color: var(--color-accent);
            border-style: dashed;
            background: var(--color-accent-soft);
        }
    }

    &::before,
    &::after {
        content: '';
        position: absolute;
        inset-block: .5rem;
        width: 3px;
        border-radius: 999px;
        background: var(--color-accent);
        opacity: 0;
        transition: opacity .12s;
        pointer-events: none;
        z-index: 4;
    }

    &::before { left: .5rem; }
    &::after  { right: .5rem; }

    &.is-page-edge-previous::before,
    &.is-page-edge-next::after {
        opacity: .75;
    }

    &_handle {
        position: absolute;
        top: .25rem;
        left: .25rem;
        width: 1.9rem;
        height: 1.9rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--color-border);
        border-radius: .45rem;
        background: var(--color-surface);
        box-shadow: 0 2px 8px rgba(0, 0, 0, .14);
        cursor: grab;
        opacity: .78;
        transition: background-color .12s, border-color .12s, box-shadow .12s, opacity .12s, transform .12s;
        user-select: none;
        touch-action: none;
        z-index: 3;
    }

    &_handle_icon {
        width: 1rem;
        height: 1rem;
        opacity: .72;
        pointer-events: none;
    }

    &_item:hover &_handle,
    &_handle:focus-visible {
        border-color: var(--color-accent);
        background: var(--color-accent-soft);
        box-shadow: 0 3px 12px rgba(0, 0, 0, .18);
        opacity: 1;
    }

    &_item:hover &_handle_icon,
    &_handle:focus-visible &_handle_icon {
        opacity: 1;
    }

    &_item.is-dragging &_handle {
        border-color: var(--color-accent);
        background: var(--color-accent-soft);
        cursor: grabbing;
        opacity: 1;
        transform: scale(1.04);
    }

    &_drag_ghost {
        position: fixed;
        top: 0;
        left: 0;
        width: 4.5rem;
        height: 4.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: .45rem;
        border: 1px solid var(--color-accent);
        border-radius: .55rem;
        background: var(--color-surface);
        box-shadow: var(--shadow-medium);
        opacity: .92;
        pointer-events: none;
        z-index: 1000;

        img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            -webkit-user-drag: none;
            user-select: none;
        }
    }

    &_select {
        @extend %grid_stack;
        width: 100%;
        gap: .35rem;
        padding: .75rem .5rem .5rem;
        border: 0;
        background: transparent;
        cursor: pointer;
    }

    &_thumb {
        @extend %grid_center;
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: .4rem;
        background: var(--color-placeholder);
        overflow: hidden;

        img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            -webkit-user-drag: none;
            user-select: none;
        }
    }

    &_spinner {
        width: 1.75rem;
        height: 1.75rem;
        border: 3px solid color-mix(in srgb, var(--color-muted) 26%, transparent);
        border-top-color: var(--color-accent);
        border-radius: 50%;
        animation: spin .8s linear infinite;
    }

    &_index {
        color: var(--color-muted);
        font-weight: 700;
        text-align: center;
    }

    &_delete {
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

        &_icon {
            width: .85rem;
            height: .85rem;
        }
    }

    &_edit {
        position: absolute;
        bottom: .25rem;
        right: .25rem;
        width: 1.75rem;
        height: 1.75rem;
        padding: 0;
        color: var(--color-warning);

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            border-color: var(--color-warning);
        }

        &_icon {
            width: .85rem;
            height: .85rem;
        }
    }

    &_order_btn {
        position: absolute;
        left: .25rem;
        width: 1.75rem;
        height: 1.75rem;
        padding: 0;
        color: var(--color-muted);
        opacity: 0;
        transition: opacity .12s;

        &--up   { bottom: 2.25rem; }
        &--down { bottom: .25rem; }

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            border-color: var(--color-accent);
            color: var(--color-accent);
        }

        &:disabled { opacity: .2 !important; }
    }

    &_item:hover &_order_btn:not(:disabled) {
        opacity: .55;
    }

    &_order_icon {
        width: .85rem;
        height: .85rem;

        &--up { transform: rotate(180deg); }
    }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

</style>
