<script lang="ts" setup>
    import type Icon from '@/types/Icon';

    withDefaults(defineProps<{
        items?: Icon[];
        selectedId?: string | null;
        disabled?: boolean;
    }>(), {
        items: () => [],
        selectedId: null,
        disabled: false,
    });

    const emit = defineEmits<{
        (e: 'delete', id: string): void;
        (e: 'select', id: string): void;
    }>();

</script>

<template>
    <div class="preview_tab surface" :class="{ 'is-disabled': disabled }">
        <p v-if="items.length === 0" class="preview_tab__empty">
            {{ $t('previewEmpty') }}
        </p>

        <ul v-else>
            <li
                v-for="item in items"
                :key="item.id"
                class="preview_tab__item"
                :class="{ 'is-selected': item.id === selectedId }"
            >
                <button class="preview_tab__select" type="button" :disabled="disabled" @click="emit('select', item.id)">
                    <span class="preview_tab__thumb">
                        <img v-if="item.src" :src="item.src" :alt="item.alt">
                    </span>
                    <span class="preview_tab__meta">
                        <strong>{{ item.name }}</strong>
                        <small>{{ item.sizeLabel }}</small>
                    </span>
                </button>

                <button
                    class="delete action_button"
                    type="button"
                    :disabled="disabled"
                    :aria-label="$t('menu.delete')"
                    @click="emit('delete', item.id)"
                >
                    <span aria-hidden="true">
                        <img class="ui_icon delete__icon" src="@/assets/icons/close.svg" alt="">
                    </span>
                </button>
            </li>
        </ul>
    </div>
</template>

<style lang="scss" scoped>
@use '@/styles/partials/placeholders' as *;

.preview_tab {
    min-height: 18rem;
    overflow: hidden;
}

.is-disabled {
    opacity: .55;
    pointer-events: none;
}

.preview_tab__empty {
    @extend %grid_center;
    min-height: 18rem;
    margin: 0;
    padding: 2rem;
    color: var(--color-muted);
    text-align: center;
}

ul {
    @extend %grid_stack;
    list-style: none;
    margin: 0;
    padding: .75rem;
    gap: .6rem;
}

.preview_tab__item {
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
}

.preview_tab__select {
    @extend %fx_start_center;
    min-width: 0;
    gap: .8rem;
    padding: .65rem;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

.preview_tab__thumb {
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

.preview_tab__meta {
    min-width: 0;
    @extend %grid_stack;
    gap: .2rem;

    strong,
    small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    strong {
        color: var(--color-text);
    }

    small {
        color: var(--color-muted);
    }
}

.delete {
    width: 2.25rem;
    height: 2.25rem;
    margin-right: .55rem;
    padding: 0;
    color: var(--color-danger);
    font-weight: 800;

    &:hover,
    &:focus-visible {
        border-color: var(--color-danger);
    }
}

.delete__icon {
    width: 1rem;
    height: 1rem;
}

</style>
