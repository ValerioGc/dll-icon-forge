<script lang="ts" setup>

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useProjectStore } from '@/stores/project';
import type { ProjectMode } from '@/types/modes';

const { t } = useI18n();
const project = useProjectStore();

const emit = defineEmits<{
    (e: 'selectMode', newMode: ProjectMode): void;
}>();

interface AppMode {
    id: ProjectMode;
    title: string;
    hint: string;
    icon: string;
}

import plus from '@/assets/icons/actions/plus.svg';
import edit from '@/assets/icons/actions/edit.svg';

const modes = computed<AppMode[]>(() => [
    {
        id: 'create',
        title: t('common.createMode'),
        hint: t('homeViewCreateHint'),
        icon: plus,
    },
    {
        id: 'edit',
        title: t('common.editMode'),
        hint: t('homeViewEditHint'),
        icon: edit,
    },
]);

</script>

<template>
    <section class="home_view">

        <div class="home_view_intro">
            <h1>{{ t('homeView') }}</h1>
            <p>{{ t('homeViewDesc') }}</p>
        </div>

        <!-- Notice area -->
        <div v-if="project.lastNotice"
            class="home_view_notice"
            :class="`home_view_notice--${project.lastNotice.type}`"
        >
            <output class="home_view_notice_content">
                <strong>{{ project.lastNotice.title }}</strong>
                <span>{{ project.lastNotice.body }}</span>
            </output>
            
            <button type="button" :aria-label="t('common.dismiss')" @click="project.setLastNotice(null)">
                <img class="ui_icon themed_icon" src="@/assets/icons/actions/close.svg" alt="" aria-hidden="true">
            </button>
        </div>

        <div class="home_view_mode" aria-label="Project mode">
            <p>{{ t('homeViewChooseMode') }}</p>

            <!-- App modes buttons -->
            <button v-for="mode in modes" :key="mode.id"
                    type="button" class="mode_button surface" 
                    @click.prevent="emit('selectMode', mode.id)" 
            >
                <span class="mode_button_title">
                    <img class="ui_icon mode_button_icon themed_icon" :src="mode.icon" alt="" aria-hidden="true" />
                    <span>{{ mode.title }}</span>
                </span>
                <small>{{ mode.hint }}</small>
            </button>
        </div>
    </section>
</template>

<style lang="scss" scoped>

.home_view {
    overflow-y: hidden;
    width: min(920px, 100%);
    @extend %grid_stack;
    gap: 2rem;

    p,h1 {
        margin: 0;
    }
    
    &_intro {
        @extend %grid_stack;
        gap: .75rem;

        h1 {
            font-size: clamp(2rem, 4vw, 3.75rem);
            line-height: 1.2;
            color: var(--color-heading);
        }

        p {
            max-width: 660px;
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
            color: var(--color-text);
            font-weight: 700;
            margin-bottom: .75rem;
        }
    }
}

.home_view_notice {
    @extend %fx_between_center;
    gap: 1rem;
    padding: .85rem 1rem;
    border: 1px solid var(--color-accent);
    border-radius: .5rem;
    background: var(--color-accent-soft);
    color: var(--color-text);

    &_content {
        @extend %grid_stack;
        gap: .2rem;
    }

    strong {
        color: var(--color-heading);
    }

    span {
        color: var(--color-muted);
        line-height: 1.45;
    }

    button {
        border: 0;
        background: transparent;
        color: var(--color-muted);
        cursor: pointer;
        font-weight: 800;

        &:hover,
        &:focus-visible {
            color: var(--color-text);
            outline: none;
        }
    }
}

.mode_button {
    min-height: 7.5rem;
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
        font-size: 1.5rem;
        font-weight: 800;
    }
    
    &_icon {
        width: 1.7rem;
        height: 1.7rem;
        margin-right: .5rem;
    }
}

@media (max-width: 700px) {
    .home_view_mode {
        grid-template-columns: 1fr;
    }
}

</style>
