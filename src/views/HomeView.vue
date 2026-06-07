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
    badge: string;
    points: string[];
    icon: string;
}

import plus from '@/assets/icons/actions/plus.svg';
import edit from '@/assets/icons/actions/edit.svg';

const modes = computed<AppMode[]>(() => [
    {
        id: 'create',
        title: t('common.createMode'),
        hint: t('homeViewCreateHint'),
        badge: t('homeViewCreateBadge'),
        points: [
            t('homeViewCreatePoint1'),
            t('homeViewCreatePoint2'),
            t('homeViewCreatePoint3'),
        ],
        icon: plus,
    },
    {
        id: 'edit',
        title: t('common.editMode'),
        hint: t('homeViewEditHint'),
        badge: t('homeViewEditBadge'),
        points: [
            t('homeViewEditPoint1'),
            t('homeViewEditPoint2'),
            t('homeViewEditPoint3'),
        ],
        icon: edit,
    },
]);

</script>

<template>
    <section class="home_view">

        <div class="home_view_intro">
            <span class="home_view_kicker">{{ t('homeViewKicker') }}</span>
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
                <span class="mode_button_badge">{{ mode.badge }}</span>
                <span class="mode_button_title">
                    <img class="ui_icon mode_button_icon themed_icon" :src="mode.icon" alt="" aria-hidden="true" />
                    <span>{{ mode.title }}</span>
                </span>
                <span class="mode_button_hint">{{ mode.hint }}</span>
                <ul class="mode_button_points" :aria-label="t('homeViewWorkflowHighlights')">
                    <li v-for="point in mode.points" :key="point">{{ point }}</li>
                </ul>
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

    &_kicker {
        width: fit-content;
        padding: .25rem .55rem;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background: var(--color-control-background);
        color: var(--color-muted);
        font-size: .75rem;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: uppercase;
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
    min-height: 13rem;
    position: relative;
    @extend %grid_stack;
    align-content: start;
    gap: .85rem;
    padding: 1.25rem 1.25rem 1.15rem;
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

    &_badge {
        width: fit-content;
        padding: .25rem .5rem;
        border-radius: 999px;
        background: var(--color-accent-soft);
        color: var(--color-accent);
        font-size: .72rem;
        font-weight: 800;
        text-transform: uppercase;
    }

    &_title {
        @extend %fx_start_center;
        font-size: 1.5rem;
        font-weight: 800;
    }

    &_hint {
        color: var(--color-muted);
        line-height: 1.45;
    }

    &_points {
        @extend %grid_stack;
        gap: .45rem;
        margin: .15rem 0 0;
        padding: 0;
        list-style: none;
        color: var(--color-text);
        font-size: .86rem;
        line-height: 1.35;

        li {
            position: relative;
            padding-left: 1.05rem;

            &::before {
                content: '';
                position: absolute;
                top: .52rem;
                left: 0;
                width: .36rem;
                height: .36rem;
                border-radius: 50%;
                background: var(--color-accent);
            }
        }
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
