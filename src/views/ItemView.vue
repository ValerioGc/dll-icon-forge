<script setup lang="ts">

import { computed, defineAsyncComponent, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import IconCollectionView from '@/components/explorer/IconCollectionView.vue';
import MenuTab from '@/components/explorer/MenuTab.vue';
import FileDropZone from '@/components/upload/FileDropZone.vue';

import { chooseExistingDll, chooseIconSources, ipcErrorMessage } from '@/services/tauriProject';
import { useProjectStore } from '@/stores/project';
import type { ProjectMode } from '@/types/modes';

const ConfirmDialog = defineAsyncComponent(() => import('@/components/dialogs/ConfirmDialog.vue'));


// CHECK
defineOptions({
    name: 'ItemView',
});

const { t } = useI18n();
const project = useProjectStore();
const { sourceLabel, sourcePath, selectedCount, icons, buildState, lastError } = storeToRefs(project);

const props = defineProps<{
    mode: ProjectMode;
}>();

const emit = defineEmits<{
    (e: 'home'): void;
}>();

const showConfirmDelete = ref(false);
const showConfirmReset = ref(false);

const title = computed(() => {
    return props.mode === 'create' ? t('common.createMode') : t('common.editMode');
});

const description = computed(() => {
    return props.mode === 'create' ? t('itemViewCreateDesc') : t('itemViewEditDesc');
});

const isEditLocked = computed(() => {
    return props.mode === 'edit' && sourceLabel.value === null;
});

const isBuilding = computed(() => {
    return buildState.value === 'validating' || buildState.value === 'building';
});

const isSubmitDisabled = computed(() => {
    return !project.canBuild || isBuilding.value;
});

const itemCountLabel = computed(() => {
    if (selectedCount.value > 0) {
        return t('itemCountWithSelection', {
            count: icons.value.length,
            selected: selectedCount.value,
        });
    }
    return t('itemCount', { count: icons.value.length });
});

const deleteConfirmMessage = computed(() => {
    return selectedCount.value === 1
        ? t('confirm.deleteSingle')
        : t('confirm.deleteMultiple', { count: selectedCount.value });
});

function handleEditSourceFiles(files: File[]): void {
    const [file] = files;
    if (file) 
        project.setEditSourceFile(file);
}

function handleIconFiles(files: File[]): void {
    project.addFiles(files);
}

async function handleChooseEditSource(): Promise<void> {
    try {
        const path = await chooseExistingDll();
        if (path) 
            await project.loadExistingDllPath(path);
    } catch (error) {
        project.setLastError(ipcErrorMessage(error));
    }
}

async function handleChooseIconSources(): Promise<void> {
    try {
        const paths = await chooseIconSources();
        await project.addIconSources(paths);
    } catch (error) {
        project.setLastError(ipcErrorMessage(error));
    }
}

function handleDeleteClick(): void {
    showConfirmDelete.value = true;
}

function handleConfirmDelete(): void {
    showConfirmDelete.value = false;
    project.removeSelectedIcons();
}

async function handleConfirmReset(): Promise<void> {
    showConfirmReset.value = false;
    await project.resetToSource();
}

async function handleSubmit(): Promise<void> {
    const submitted = await project.submitProject();
    if (submitted && props.mode === 'create')
        emit('home');
}

</script>

<template>
    <div class="item_view">

        <ConfirmDialog v-if="showConfirmDelete"
                    :title="t('confirm.deleteTitle')"
                    :message="deleteConfirmMessage"
                    @confirm="handleConfirmDelete"
                    @cancel="showConfirmDelete = false"
        />

        <ConfirmDialog v-if="showConfirmReset"
                    :title="t('confirm.resetTitle')"
                    :message="t('confirm.resetMessage')"
                    @confirm="handleConfirmReset"
                    @cancel="showConfirmReset = false"
        />
        
        <!-- Back button -->
        <button type="button" class="back_button" @click.prevent="emit('home')">
            <img class="ui_icon back_button_icon" src="@/assets/icons/navigation/back.svg" alt="" />
            {{ t('common.backHome') }}
        </button>

        <header class="item_view_header">
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>
        </header>

        <!-- Existing file drop zones -->
        <FileDropZone v-if="props.mode === 'edit'"
            :title="t('editSourceTitle')"
            :description="project.sourceLabel ?? t('editSourceEmpty')"
            :button-text="t('common.chooseExistingFile')"
            accept=".dll"
            primary
            native-picker
            @files="handleEditSourceFiles"
            @browse="handleChooseEditSource"
        />

        <!-- Icon drop zone upload -->
        <FileDropZone v-if="!isEditLocked"
            :title="t('dropZoneTitle')"
            :description="t('dropZoneDesc')"
            :button-text="t('common.chooseFile')"
            accept=".ico,.png,image/png,image/x-icon"
            multiple
            primary
            native-picker
            @files="handleIconFiles"
            @browse="handleChooseIconSources"
        />

        <!-- Item view content -->
        <div v-if="!isEditLocked" class="item_view_content">
            <MenuTab
                :selected-count="selectedCount"
                :disabled="isBuilding"
                @delete="handleDeleteClick"
            />

            <div class="item_view_collection">

                <IconCollectionView />
                <div v-if="isBuilding" class="item_view_collection_overlay">
                    <span class="item_view_collection_spinner" aria-hidden="true"></span>
                </div>
            </div>
        </div>

        <div v-if="lastError" class="item_view_error">
            <span>{{ lastError }}</span>
            <button type="button" class="item_view_error_close" :aria-label="t('common.dismiss')" @click="project.setLastError(null)">
                <img class="ui_icon themed_icon" src="@/assets/icons/actions/close.svg" alt="" aria-hidden="true" />
            </button>
        </div>

        <div v-if="project.lastNotice && props.mode === 'edit'" class="item_view_notice">
            <output class="item_view_notice_content">
                <strong>{{ project.lastNotice.title }}</strong>
                <span>{{ project.lastNotice.body }}</span>
            </output>
            <button type="button" :aria-label="t('common.dismiss')" @click="project.setLastNotice(null)">
                <img class="ui_icon themed_icon" src="@/assets/icons/actions/close.svg" alt="" aria-hidden="true" />
            </button>
        </div>

        <footer v-if="!isEditLocked" class="item_view_footer">
            <p>{{ itemCountLabel }}</p>

            <div class="item_view_footer_actions">
                <button v-if="props.mode === 'edit' && sourcePath !== null"
                    type="button"
                    class="item_button item_button--danger"
                    :disabled="!project.dirty || isBuilding"
                    :aria-disabled="!project.dirty || isBuilding"
                    @click.prevent="showConfirmReset = true"
                >
                    {{ t('common.reset') }}
                </button>

                <button type="button"
                    class="item_button item_button--primary"
                    :disabled="isSubmitDisabled"
                    :aria-disabled="isSubmitDisabled"
                    @click.prevent="handleSubmit"
                >
                    <img class="ui_icon item_button_icon" src="@/assets/icons/actions/save.svg" alt="" />
                    {{ t('common.submit') }}
                </button>
            </div>
        </footer>
    </div>
</template>

<style lang="scss" scoped>

.back_button {
    @extend %fx_inline_center;
    border: 1px solid var(--color-heading);
    margin-left: auto;
    width: max-content;
    min-height: 2.5rem;
    gap: .5rem;
    border-radius: 6px;
    padding: .5rem;
    font-weight: 700;
    cursor: pointer;
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-on-accent);
    transition:
        border-color .16s ease,
        background .16s ease,
        color .16s ease,
        transform .16s ease;

    &:hover,
    &:focus-visible {
        border-color: var(--color-accent-hover);
        background: var(--color-accent-hover);
        color: var(--color-on-accent);
        outline: none;
    }

    &:active {
        transform: translateY(1px);
    }

    &_icon {
        width: 1.25rem;
        height: 1.25rem;
        filter: var(--icon-on-accent-filter);
    }
}

.item_view {
    width: min(1080px, 100%);
    @extend %grid_stack;
    gap: 1.25rem;

    &_header {
        @extend %grid_stack;
        gap: .5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--color-border);

        h1,
        p {
            margin: 0;
        }

        h1 {
            color: var(--color-heading);
            font-size: clamp(1.75rem, 3vw, 2.4rem);
            line-height: 1.05;
        }

        p {
            max-width: 760px;
            color: var(--color-muted);
            line-height: 1.55;
        }
    }

    &_content {
        @extend %grid_stack;
        gap: .75rem;
    }

    &_collection {
        position: relative;
        min-height: 6rem;
    }

    &_collection_overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-overlay);
        border-radius: .5rem;
        z-index: 5;
    }

    &_collection_spinner {
        display: block;
        width: 2.5rem;
        height: 2.5rem;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-accent);
        border-radius: 50%;
        animation: spin .8s linear infinite;
    }

    &_error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .75rem;
        padding: .7rem 1rem;
        border: 1px solid var(--color-danger);
        border-radius: .5rem;
        color: var(--color-danger);
        font-size: .9rem;
        line-height: 1.45;

        &_close {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 0;
            font-size: 1.1rem;
            line-height: 1;
            flex-shrink: 0;

            &:hover {
                opacity: .7;
            }
        }
    }

    &_notice {
        @extend %fx_between_center;
        gap: .75rem;
        padding: .7rem 1rem;
        border: 1px solid var(--color-accent);
        border-radius: .5rem;
        background: var(--color-accent-soft);
        color: var(--color-text);
        font-size: .9rem;
        line-height: 1.45;

        &_content {
            @extend %grid_stack;
            gap: .2rem;
        }

        strong {
            color: var(--color-heading);
        }

        span {
            color: var(--color-muted);
        }

        button {
            border: 0;
            background: transparent;
            color: var(--color-muted);
            cursor: pointer;
            font-weight: 800;
            flex-shrink: 0;

            &:hover,
            &:focus-visible {
                color: var(--color-text);
                outline: none;
            }
        }
    }

    &_footer {
        @extend %fx_between_center;
        gap: 1rem;
        padding-top: .75rem;
        border-top: 1px solid var(--color-border);

        p {
            margin: 0;
            color: var(--color-muted);
            font-weight: 700;
        }

        &_actions {
            @extend %fx_inline_center;
            gap: .5rem;
            flex-wrap: wrap;
        }
    }
}

.item_button {
    @extend %fx_inline_center;
    gap: .5rem;
    min-height: 2.75rem;
    padding: 0 1rem;
    border: 1px solid var(--color-border);
    border-radius: .45rem;
    background: var(--color-control-background);
    color: var(--color-text);
    font-weight: 800;
    cursor: pointer;
    transition:
        border-color .16s ease,
        background .16s ease,
        color .16s ease,
        opacity .16s ease,
        transform .16s ease;

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
        border-color: var(--color-accent);
        outline: none;
    }

    &:active:not(:disabled) {
        transform: translateY(1px);
    }

    &:disabled {
        color: var(--color-muted);
        cursor: not-allowed;
        opacity: .55;
    }

    &--primary {
        border-color: var(--color-accent);
        background: var(--color-accent);
        color: var(--color-on-accent);

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            border-color: var(--color-accent-hover);
            background: var(--color-accent-hover);
        }
    }

    &--danger {
        border-color: var(--color-danger);
        color: var(--color-danger);

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            background: var(--color-danger);
            color: #ffffff;
        }
    }

    &_icon {
        filter: var(--icon-on-accent-filter);
    }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
    .item_view_footer {
        align-items: stretch;
        flex-direction: column;
    }
}

</style>
