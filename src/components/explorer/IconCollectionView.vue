<script lang="ts" setup>

import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
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

const { icons, selectedIconIds } = storeToRefs(project);

// ── Search ────────────────────────────────────────────────────────────────────

const searchQuery = ref('');

const filteredIcons = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return icons.value;
    return icons.value.filter((i) => i.name?.toLowerCase().includes(q));
});

// ── Local pagination (operates on filteredIcons) ──────────────────────────────

const localPage = ref(0);

const localTotalPages = computed(() =>
    Math.max(1, Math.ceil(filteredIcons.value.length / settings.pageSize)),
);

const localPaginatedIcons = computed(() => {
    const start = localPage.value * settings.pageSize;
    return filteredIcons.value.slice(start, start + settings.pageSize);
});

const localCanGoPrevious = computed(() => localPage.value > 0);
const localCanGoNext = computed(() => localPage.value < localTotalPages.value - 1);
const localStartIndex = computed(() => localPage.value * settings.pageSize);

watch(searchQuery, () => { localPage.value = 0; });

watch(localTotalPages, (newTotal) => {
    if (localPage.value >= newTotal)
        localPage.value = Math.max(0, newTotal - 1);
});

function goToNextPage(): void {
    if (localCanGoNext.value) localPage.value += 1;
}

function goToPreviousPage(): void {
    if (localCanGoPrevious.value) localPage.value -= 1;
}

// ── View state ────────────────────────────────────────────────────────────────

const isEmpty = computed(() => icons.value.length === 0);
const isFilterEmpty = computed(() => filteredIcons.value.length === 0 && !isEmpty.value);
const activeView = computed<ViewMode>(() => settings.viewMode);
const isSortable = computed(() => searchQuery.value.trim().length === 0);

// ── Selection ─────────────────────────────────────────────────────────────────

const anchorId = ref<string | null>(null);

function handleSelect(id: string, additive: boolean, range: boolean): void {
    if (range && anchorId.value) {
        const fromIdx = filteredIcons.value.findIndex((i) => i.id === anchorId.value);
        const toIdx = filteredIcons.value.findIndex((i) => i.id === id);
        if (fromIdx !== -1 && toIdx !== -1) {
            const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
            project.setSelectedIconIds(filteredIcons.value.slice(start, end + 1).map((i) => i.id));
        }
    } else if (additive) {
        project.toggleIconSelection(id);
        anchorId.value = id;
    } else {
        project.selectIcon(id);
        anchorId.value = id;
    }
}

function handleDelete(id: string): void {
    project.removeIcon(id);
}

function handleReorder(fromId: string, toId: string): void {
    project.reorderIcon(fromId, toId);
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isEmpty.value) {
        e.preventDefault();
        project.setSelectedIconIds(filteredIcons.value.map((i) => i.id));
        if (filteredIcons.value[0]) anchorId.value = filteredIcons.value[0].id;
    }
}

onMounted(() => globalThis.addEventListener('keydown', handleKeydown));
onUnmounted(() => globalThis.removeEventListener('keydown', handleKeydown));

// ── Toolbar handlers ──────────────────────────────────────────────────────────

function handleViewMode(next: ViewMode): void {
    settings.setViewMode(next);
}

function handlePageSize(next: PageSize): void {
    settings.setPageSize(next);
    localPage.value = 0;
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

            <div class="icon_collection_view_search">
                <img class="icon_collection_view_search_icon themed_icon" src="@/assets/icons/actions/search.svg" alt="" aria-hidden="true" />
                <input
                    v-model="searchQuery"
                    type="search"
                    class="icon_collection_view_search_input"
                    :placeholder="t('search.placeholder')"
                    :aria-label="t('search.label')"
                    :disabled="isEmpty"
                    autocomplete="off"
                />
            </div>

            <PageSizeSelector
                :value="settings.pageSize"
                :disabled="isEmpty"
                @change="handlePageSize"
            />
        </header>

        <p v-if="isEmpty" class="icon_collection_empty">{{ t('previewEmpty') }}</p>
        <p v-else-if="isFilterEmpty" class="icon_collection_empty">{{ t('search.noResults') }}</p>

        <IconListView v-else-if="activeView === 'list'"
            :items="localPaginatedIcons"
            :selected-ids="selectedIconIds"
            :start-index="localStartIndex"
            :sortable="isSortable"
            @select="handleSelect"
            @delete="handleDelete"
            @reorder="handleReorder"
        />

        <IconGridView v-else
            :items="localPaginatedIcons"
            :selected-ids="selectedIconIds"
            :start-index="localStartIndex"
            :sortable="isSortable"
            @select="handleSelect"
            @delete="handleDelete"
            @reorder="handleReorder"
        />

        <footer v-if="!isEmpty" class="icon_collection_view_footer">
            <PaginationControls
                :page="localPage"
                :total-pages="localTotalPages"
                :can-go-previous="localCanGoPrevious"
                :can-go-next="localCanGoNext"
                @previous="goToPreviousPage"
                @next="goToNextPage"
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

    &_search {
        position: relative;
        flex: 1;
        min-width: 140px;

        &_icon {
            position: absolute;
            left: .55rem;
            top: 50%;
            transform: translateY(-50%);
            width: 1rem;
            height: 1rem;
            pointer-events: none;
            opacity: .5;
        }

        &_input {
            width: 100%;
            height: 2.25rem;
            padding: 0 .6rem 0 2rem;
            border: 1px solid var(--color-border);
            border-radius: .4rem;
            background: var(--color-surface);
            color: var(--color-text);
            font-size: .875rem;
            font-family: inherit;
            box-sizing: border-box;

            &::placeholder {
                color: var(--color-muted);
            }

            &:focus {
                outline: none;
                border-color: var(--color-accent);
            }

            &:disabled {
                opacity: .45;
                cursor: not-allowed;
            }

            &::-webkit-search-cancel-button {
                cursor: pointer;
            }
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
