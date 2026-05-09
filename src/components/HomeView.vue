<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import type { ProjectMode } from '@/types/Project';

const { t } = useI18n();

const emit = defineEmits<{
    (e: 'selectMode', newMode: ProjectMode): void;
}>();

</script>


<template>
    <section class="home_view">
        <div class="home_view_intro">
            <h1>{{ t('homeView') }}</h1>
            <p>{{ t('homeViewDesc') }}</p>
        </div>

        <div class="home_view_mode" aria-label="Project mode">
            <p>{{ t('homeViewChooseMode') }}</p>
            <button type="button" class="mode_button surface" @click.prevent="emit('selectMode', 'create')">
                <span class="mode_button_title">
                    <img class="ui_icon mode_button_icon themed_icon" src="@/assets/icons/plus.svg" alt="" aria-hidden="true">
                    <span>{{ t('common.createMode') }}</span>
                </span>
                <small>{{ t('homeViewCreateHint') }}</small>
            </button>
            <button type="button" class="mode_button surface" @click.prevent="emit('selectMode', 'edit')">
                <span class="mode_button_title">
                    <img class="ui_icon mode_button_icon themed_icon" src="@/assets/icons/edit.svg" alt="" aria-hidden="true">
                    <span>{{ t('common.editMode') }}</span>
                </span>
                <small>{{ t('homeViewEditHint') }}</small>
            </button>
        </div>
    </section>
</template>

<style lang="scss" scoped>

.home_view {
    width: min(920px, 100%);
    @extend %grid_stack;
    gap: 2rem;
    
    &_intro {
        @extend %grid_stack;
        gap: .75rem;

        h1 {
            margin: 0;
            font-size: clamp(2rem, 4vw, 3.75rem);
            line-height: 1;
            color: var(--color-heading);
        }

        p {
            max-width: 660px;
            margin: 0;
            font-size: 1.05rem;
            line-height: 1.6;
            color: var(--color-muted);
        }
    }

    &_mode {
        @extend %grid_stack;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;

        > p {
            grid-column: 1 / -1;
            margin: 0;
            color: var(--color-text);
            font-weight: 700;
        }
    }
}

.mode_button {
    min-height: 9rem;
    @extend %grid_stack;
    align-content: space-between;
    gap: .75rem;
    padding: 1.25rem;
    text-align: left;
    color: var(--color-text);
    cursor: pointer;
    box-shadow: var(--shadow-soft);
    transition: border-color .16s ease, transform .16s ease, box-shadow .16s ease;

    &:hover,
    &:focus-visible {
        border-color: var(--color-accent);
        transform: translateY(-1px);
        box-shadow: var(--shadow-medium);
        outline: none;
    }

    small {
        color: var(--color-muted);
        line-height: 1.45;
    }

    &_title {
        font-size: 1.2rem;
        font-weight: 800;
    }

    &_icon {
        width: 1.75rem;
        height: 1.75rem;
    }
}

@media (max-width: 700px) {
    .home_view_mode {
        grid-template-columns: 1fr;
    }
}

</style>