<script lang="ts" setup>

import { computed, onUnmounted, ref } from 'vue';
import chevronDown from '@/assets/icons/navigation/chevron-down.svg';
import closeIcon from '@/assets/icons/actions/close.svg';
import cropIcon from '@/assets/icons/actions/scissors.svg';
import moveIcon from '@/assets/icons/actions/move.svg';
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
    (e: 'dragPageEdge', direction: 'previous' | 'next' | null): void;
}>();

const PAGE_EDGE_THRESHOLD = 56;
const draggedId = ref<string | null>(null);
const dropTarget = ref<{ id: string; half: 'before' | 'after' } | null>(null);
const dragGhost = ref<{ preview: string; x: number; y: number } | null>(null);
const pageEdge = ref<'previous' | 'next' | null>(null);
const rootRef = ref<HTMLElement | null>(null);
const canReorder = computed(() => props.sortable && !props.disabled && props.totalItems > 1);

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
    dropTarget.value = null;
    dragGhost.value = createDragGhost(id, event);
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
        dropTarget.value = null;
        return;
    }

    const rect = target.getBoundingClientRect();
    const half: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    dropTarget.value = { id: targetId, half };
}

function handlePointerUp(): void {
    if (draggedId.value && dropTarget.value) {
        const insertBefore = dropTarget.value?.half !== 'after';
        emit('reorder', draggedId.value, dropTarget.value.id, insertBefore);
    }
    clearPointerDrag();
}

function clearPointerDrag(): void {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    draggedId.value = null;
    dropTarget.value = null;
    dragGhost.value = null;
    setPageEdge(null);
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
    return document.elementFromPoint(x, y)?.closest<HTMLElement>('.icon_list_view_item') ?? null;
}

function updatePageEdge(event: PointerEvent): void {
    const direction = resolvePageEdge(event);
    const canChangePage = direction === 'previous' ? props.canPagePrevious : direction === 'next' && props.canPageNext;
    setPageEdge(canChangePage ? direction : null);
}

function resolvePageEdge(event: PointerEvent): 'previous' | 'next' | null {
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

function setPageEdge(direction: 'previous' | 'next' | null): void {
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
        class="icon_list_view"
        :class="{
            'is-disabled': disabled,
            'is-page-edge-previous': pageEdge === 'previous',
            'is-page-edge-next': pageEdge === 'next',
        }"
        @click.self="emit('deselect')"
    >
        <li v-for="(item, index) in items" :key="item.id"
            class="icon_list_view_item"
            :data-icon-id="item.id"
            :class="{
                'is-selected': isSelected(item.id),
                'is-error': item.status === 'error',
                'is-drop-before': dropTarget?.id === item.id && dropTarget?.half === 'before',
                'is-drop-after': dropTarget?.id === item.id && dropTarget?.half === 'after',
                'is-dragging': draggedId === item.id,
            }"
        >
            <span v-if="canReorder"
                class="icon_list_view_handle"
                aria-hidden="true"
                :title="$t('tooltips.moveIcon')"
                @pointerdown.stop="handlePointerDown(item.id, $event)"
            >
                <img class="ui_icon icon_list_view_handle_icon themed_icon" :src="moveIcon" alt="" aria-hidden="true" />
            </span>
            <button type="button" class="icon_list_view_select"
                :disabled="disabled"
                :title="$t('tooltips.selectIcon')"
                @click="handleSelect(item.id, $event)"
            >
                <span class="icon_list_view_index" aria-hidden="true">{{ startIndex + index + 1 }}</span>
                <span class="icon_list_view_thumb">
                    <span v-if="item.previewLoading" class="icon_list_view_spinner" aria-hidden="true"></span>
                    <img v-else-if="item.preview" :src="item.preview" alt="" draggable="false">
                </span>
            </button>

            <div class="icon_list_view_actions">
                <template v-if="canReorder">
                    <button type="button"
                        class="icon_list_view_order_btn action_button"
                        :disabled="startIndex + index === 0"
                        :aria-label="$t('menu.moveUp')"
                        :title="$t('tooltips.moveUp')"
                        @click.stop="emit('moveUp', item.id)"
                    >
                        <img class="ui_icon icon_list_view_order_icon themed_icon icon_list_view_order_icon--up"
                            :src="chevronDown" alt="" aria-hidden="true" />
                    </button>
                    <button type="button"
                        class="icon_list_view_order_btn action_button"
                        :disabled="startIndex + index >= totalItems - 1"
                        :aria-label="$t('menu.moveDown')"
                        :title="$t('tooltips.moveDown')"
                        @click.stop="emit('moveDown', item.id)"
                    >
                        <img class="ui_icon icon_list_view_order_icon themed_icon"
                            :src="chevronDown" alt="" aria-hidden="true" />
                    </button>
                </template>
                <button type="button"
                    class="icon_list_view_edit action_button"
                    :disabled="disabled"
                    :aria-label="$t('menu.crop')"
                    :title="$t('tooltips.cropIcon')"
                    @click.stop="emit('edit', item.id)"
                >
                    <img class="ui_icon icon_list_view_edit_icon themed_icon" :src="cropIcon" alt="" aria-hidden="true" />
                </button>
                <button type="button" class="icon_list_view_delete action_button"
                    :disabled="disabled"
                    :aria-label="$t('menu.delete')"
                    :title="$t('tooltips.deleteIcon')"
                    @click.stop="emit('delete', item.id)"
                >
                    <img class="ui_icon icon_list_view_delete_icon themed_icon" :src="closeIcon" alt="" aria-hidden="true" />
                </button>
            </div>
        </li>

        <li v-if="dragGhost"
            class="icon_list_view_drag_ghost"
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

.icon_list_view {
    @extend %grid_stack;
    position: relative;
    list-style: none;
    margin: 0;
    padding: .75rem;
    gap: .6rem;

    &_item {
        @extend %grid_stack;
        position: relative;
        grid-template-columns: auto 1fr auto;
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
            cursor: grabbing;
        }

        &.is-drop-before::before,
        &.is-drop-after::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--color-accent);
            border-radius: 1px;
            z-index: 2;
            pointer-events: none;
        }

        &.is-drop-before::before { top: -4px; }
        &.is-drop-after::after   { bottom: -4px; }
    }

    &::before,
    &::after {
        content: '';
        position: absolute;
        inset-inline: .75rem;
        height: 3px;
        border-radius: 999px;
        background: var(--color-accent);
        opacity: 0;
        transition: opacity .12s;
        pointer-events: none;
        z-index: 4;
    }

    &::before { top: .35rem; }
    &::after  { bottom: .35rem; }

    &.is-page-edge-previous::before,
    &.is-page-edge-next::after {
        opacity: .75;
    }

    &_handle {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 2rem;
        height: 2rem;
        margin-left: .45rem;
        border: 1px solid var(--color-border);
        border-radius: .45rem;
        background: var(--color-surface);
        box-shadow: 0 2px 8px rgba(0, 0, 0, .12);
        cursor: grab;
        opacity: .78;
        transition: background-color .12s, border-color .12s, box-shadow .12s, opacity .12s, transform .12s;
        user-select: none;
        touch-action: none;
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
        box-shadow: 0 3px 12px rgba(0, 0, 0, .16);
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
        width: 4rem;
        height: 4rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: .4rem;
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
        @extend %fx_start_center;
        min-width: 0;
        gap: .8rem;
        padding: .65rem .65rem .65rem 0;
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
        position: relative;
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
            -webkit-user-drag: none;
            user-select: none;
        }
    }

    &_spinner {
        width: 1.35rem;
        height: 1.35rem;
        border: 3px solid color-mix(in srgb, var(--color-muted) 26%, transparent);
        border-top-color: var(--color-accent);
        border-radius: 50%;
        animation: spin .8s linear infinite;
    }

    &_actions {
        @extend %fx_inline_center;
        gap: .4rem;
        margin-right: .55rem;
    }

    &_order_btn {
        width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        color: var(--color-muted);

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            border-color: var(--color-accent);
            color: var(--color-accent);
        }

        &:disabled {
            opacity: .25;
        }
    }

    &_order_icon {
        width: 1rem;
        height: 1rem;

        &--up {
            transform: rotate(180deg);
        }
    }

    &_edit {
        width: 2.25rem;
        height: 2.25rem;
        padding: 0;
        color: var(--color-warning);

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            border-color: var(--color-warning);
        }

        &_icon {
            width: 1rem;
            height: 1rem;
        }
    }

    &_delete {
        width: 2.25rem;
        height: 2.25rem;
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

@keyframes spin {
    to { transform: rotate(360deg); }
}

</style>
