<script lang="ts" setup>

import { computed, defineAsyncComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore, type PageSize, type ViewMode } from '@/stores/settings';
import PaginationControls from '@/components/pagination/PaginationControls.vue';
import PageSizeSelector from '@/components/pagination/PageSizeSelector.vue';

const IconListView = defineAsyncComponent(() => import('@/components/explorer/IconListView.vue'));
const IconGridView = defineAsyncComponent(() => import('@/components/explorer/IconGridView.vue'));

const { t } = useI18n();
const project = useProjectStore();
const settings = useSettingsStore();

const {
    icons,
    paginatedIcons,
    selectedIconIds,
    page,
    totalPages,
    canGoPrevious,
    canGoNext,
    currentPageGlobalStart,
} = storeToRefs(project);

const isEmpty = computed(() => icons.value.length === 0);
const activeView = computed<ViewMode>(() => settings.viewMode);

function handleSelect(id: string, additive: boolean): void {
    if (additive) {
        project.toggleIconSelection(id);
    } else {
        project.selectIcon(id);
    }
}

function handleDelete(id: string): void {
    project.removeIcon(id);
}

function handleViewMode(next: ViewMode): void {
    settings.setViewMode(next);
}

function handlePageSize(next: PageSize): void {
    settings.setPageSize(next);
    project.resetPage();
}

</script>

<template>
    <section class="icon_collection_view surface">
        <header class="icon_collection_view_toolbar">
            
            <fieldset class="icon_collection_view_view_mode">
                <legend class="icon_collection_view_view_legend">{{ t('viewMode.label') }}</legend>
                <button type="button"
                    class="icon_collection_view_view_button action_button"
                    :class="{ 'is-active': activeView === 'list' }"
                    :aria-pressed="activeView === 'list'"
                    :aria-label="t('viewMode.list')"
                    :title="t('viewMode.list')"
                    :disabled="isEmpty"
                    @click.prevent="handleViewMode('list')"
                >
                    <img class="ui_icon themed_icon" src="@/assets/icons/view/list.svg" alt="" aria-hidden="true">
                </button>
                <button type="button"
                    class="icon_collection_view_view_button action_button"
                    :class="{ 'is-active': activeView === 'grid' }"
                    :aria-pressed="activeView === 'grid'"
                    :aria-label="t('viewMode.grid')"
                    :title="t('viewMode.grid')"
                    :disabled="isEmpty"
                    @click.prevent="handleViewMode('grid')"
                >
                    <img class="ui_icon themed_icon" src="@/assets/icons/view/grid.svg" alt="" aria-hidden="true" />
                </button>
            </fieldset>

            <PageSizeSelector
                :value="settings.pageSize"
                :disabled="isEmpty"
                @change="handlePageSize"
            />
        </header>

        <p class="icon_collection_empty" v-if="isEmpty">{{ t('previewEmpty') }}</p>

        <IconListView v-else-if="activeView === 'list'"
            :items="paginatedIcons"
            :selected-ids="selectedIconIds"
            :start-index="currentPageGlobalStart"
            @select="handleSelect"
            @delete="handleDelete"
        />

        <IconGridView v-else
            :items="paginatedIcons"
            :selected-ids="selectedIconIds"
            :start-index="currentPageGlobalStart"
            @select="handleSelect"
            @delete="handleDelete"
        />

        <footer v-if="!isEmpty" class="icon_collection_view_footer">
            <PaginationControls
                :page="page"
                :total-pages="totalPages"
                :can-go-previous="canGoPrevious"
                :can-go-next="canGoNext"
                @previous="project.goToPreviousPage"
                @next="project.goToNextPage"
            />
        </footer>
    </section>
</template>

<style lang="scss" scoped>

.icon_collection_empty {
    @extend %grid_center;
    min-height: 18rem;
    margin: 0;
    padding: 2rem;
    color: var(--color-muted);
    text-align: center;
}

.icon_collection_view {
    @extend %grid_stack;
    min-height: 18rem;
    overflow: hidden;

    &_toolbar {
        @extend %fx_between_center;
        gap: 1rem;
        padding: .65rem .75rem;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-control-background);
        flex-wrap: wrap;
        @media (max-width: 600px) {
            align-items: stretch;
            flex-direction: column;
        }
    }

    &_view_mode {
        @extend %fx_inline_center;
        gap: .35rem;
        min-inline-size: 0;
        margin: 0;
        padding: 0;
        border: 0;
    }

    &_view_legend {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    &_view_button {
        width: 2.25rem;
        min-height: 2.25rem;
        padding: 0;
        font-weight: 700;

        &.is-active {
            border-color: var(--color-accent);
            background: var(--color-accent-soft);
            color: var(--color-text);
        }
    }

    &_footer {
        @extend %fx_center;
        padding: .65rem .75rem;
        border-top: 1px solid var(--color-border);
        background: var(--color-control-background);
    }
}

</style>
