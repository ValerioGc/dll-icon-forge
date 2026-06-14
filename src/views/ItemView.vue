<script setup lang="ts">

import { computed, defineAsyncComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import IconCollectionView from '@/components/explorer/IconCollectionView.vue';
import MenuTab from '@/components/explorer/MenuTab.vue';
import FileDropZone from '@/components/upload/FileDropZone.vue';
import warningIcon from '@/assets/icons/actions/warning.svg';

import { useProjectStore } from '@/stores/project';
import type { ProjectMode } from '@/types/modes';

import { useCrop } from '@/composables/useCrop';
import { useConfirmDialogs } from '@/composables/useConfirmDialogs';
import { useFileUpload } from '@/composables/useFileUpload';
import { useItemMeta } from '@/composables/useItemMeta';

const ConfirmDialog = defineAsyncComponent(() => import('@/components/dialogs/ConfirmDialog.vue'));
const ImageCropDialog = defineAsyncComponent(() => import('@/components/dialogs/ImageCropDialog.vue'));

defineOptions({
    name: 'ItemView',
});

const { t } = useI18n();
const project = useProjectStore();
const { sourcePath, sourceSize, selectedCount, selectedIconIds, buildState, lastError, lastWarnings } = storeToRefs(project);

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const editSourceDescription = computed(() => {
    if (!project.sourceLabel) return t('editSourceEmpty');
    if (sourceSize.value !== null)
        return `${project.sourceLabel} · ${formatFileSize(sourceSize.value)}`;
    return project.sourceLabel;
});

const props = defineProps<{
    mode: ProjectMode;
}>();

const emit = defineEmits<{
    (e: 'home'): void;
}>();

const { title, description, isEditLocked, itemCountLabel } = useItemMeta(() => props.mode);
const { showCropDialog, cropTargetIcon, handleEdit, handleCropConfirm, handleCropCancel } = useCrop();
const { showConfirmDelete, showConfirmReset, deleteConfirmMessage, handleDeleteClick, handleConfirmDelete, handleConfirmReset } = useConfirmDialogs();
const { handleEditSourceFiles, handleIconFiles, handleChooseEditSource } = useFileUpload();

const isBuilding = computed(() =>
    buildState.value === 'validating' || buildState.value === 'building',
);

const isSubmitDisabled = computed(() =>
    !project.canBuild || isBuilding.value,
);

const invalidIconCount = computed(() =>
    project.icons.filter((i) => i.status === 'error').length,
);

async function handleSubmit(): Promise<void> {
    const submitted = await project.submitProject();
    if (submitted && props.mode === 'create')
        emit('home');
}

function handleEditSelectedIcon(): void {
    if (selectedIconIds.value.length !== 1)
        return;
    handleEdit(selectedIconIds.value[0]);
}

</script>

<template>
    <div class="item_view">

        <ImageCropDialog v-if="showCropDialog && cropTargetIcon"
                    :icon-id="cropTargetIcon.id"
                    :preview-src="cropTargetIcon.preview"
                    :icon-name="cropTargetIcon.name ?? ''"
                    @confirm="handleCropConfirm"
                    @cancel="handleCropCancel"
        />

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
        
        <header class="item_view_header">
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>
            <section class="item_view_formats" :aria-label="t('supportedFormatsLabel')">
                <strong>{{ t('supportedFormatsTitle') }}</strong>
                <span>{{ t('supportedFormatsList') }}</span>
            </section>
        </header>

        <!-- Existing file drop zones -->
        <FileDropZone v-if="props.mode === 'edit'"
            :title="t('editSourceTitle')"
            :description="editSourceDescription"
            :button-text="t('common.chooseExistingFile')"
            :button-title="t('tooltips.chooseExistingFile')"
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
            :button-title="t('tooltips.chooseFile')"
            accept=".ico,.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
            multiple
            primary
            @files="handleIconFiles"
        />

        <!-- Item view content -->
        <div v-if="!isEditLocked" class="item_view_content">
            <MenuTab
                :selected-count="selectedCount"
                :disabled="isBuilding"
                @edit="handleEditSelectedIcon"
                @delete="handleDeleteClick"
            />

            <div class="item_view_collection">

                <IconCollectionView @edit="handleEdit" />
                <div v-if="isBuilding" class="item_view_collection_overlay">
                    <span class="item_view_collection_spinner" aria-hidden="true"></span>
                </div>
            </div>
        </div>

        <div v-if="lastWarnings.length > 0" class="item_view_warning">
            <div class="item_view_warning_body">
                <strong>{{ t('warnings.title') }}</strong>
                <ul>
                    <li v-for="(w, i) in lastWarnings" :key="i">{{ w }}</li>
                </ul>
            </div>
            <button type="button" class="item_view_warning_close" :aria-label="t('common.dismiss')" @click="project.setLastWarnings([])">
                <img class="ui_icon themed_icon" src="@/assets/icons/actions/close.svg" alt="" aria-hidden="true" />
            </button>
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
            <output v-if="invalidIconCount > 0" class="item_view_invalid_notice">
                <span class="item_view_invalid_notice_icon" aria-hidden="true">
                    <img class="ui_icon themed_icon" :src="warningIcon" alt="" />
                </span>
                <span class="item_view_invalid_notice_copy">
                    <strong>{{ t('invalidIconsTitle', { count: invalidIconCount }) }}</strong>
                    <span>{{ t('invalidIconsHint') }}</span>
                </span>
            </output>

            <div class="item_view_footer_row">
                <p>{{ itemCountLabel }}</p>

                <div class="item_view_footer_actions">
                    <button v-if="props.mode === 'edit' && sourcePath !== null"
                        type="button"
                        class="item_button item_button--danger"
                        :disabled="!project.dirty || isBuilding"
                        :aria-disabled="!project.dirty || isBuilding"
                        :title="t('tooltips.resetProject')"
                        @click.prevent="showConfirmReset = true"
                    >
                        {{ t('common.reset') }}
                    </button>

                    <button type="button"
                        class="item_button item_button--primary"
                        :disabled="isSubmitDisabled"
                        :aria-disabled="isSubmitDisabled"
                        :title="t('tooltips.submitProject')"
                        @click.prevent="handleSubmit"
                    >
                        <svg class="ui_icon item_button_icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M18.1716 1C18.702 1 19.2107 1.21071 19.5858 1.58579L22.4142 4.41421C22.7893 4.78929 23 5.29799 23 5.82843V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4C1 2.34315 2.34315 1 4 1H18.1716ZM4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21L5 21L5 15C5 13.3431 6.34315 12 8 12L16 12C17.6569 12 19 13.3431 19 15V21H20C20.5523 21 21 20.5523 21 20V6.82843C21 6.29799 20.7893 5.78929 20.4142 5.41421L18.5858 3.58579C18.2107 3.21071 17.702 3 17.1716 3H17V5C17 6.65685 15.6569 8 14 8H10C8.34315 8 7 6.65685 7 5V3H4ZM17 21V15C17 14.4477 16.5523 14 16 14L8 14C7.44772 14 7 14.4477 7 15L7 21L17 21ZM9 3H15V5C15 5.55228 14.5523 6 14 6H10C9.44772 6 9 5.55228 9 5V3Z" />
                        </svg>
                        {{ t('common.submit') }}
                    </button>
                </div>
            </div>
        </footer>
    </div>
</template>

<style lang="scss" scoped>

.item_view {
    width: min(1080px, 100%);
    @extend %grid_stack;
    gap: 1.25rem;

    &_header {
        @extend %grid_stack;
        gap: .75rem;
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

    &_formats {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: .35rem .65rem;
        color: var(--color-muted);
        font-size: .9rem;
        line-height: 1.45;

        strong {
            color: var(--color-text);
            font-size: .86rem;
            font-weight: 800;
            text-transform: uppercase;
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

    &_warning {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: .75rem;
        padding: .7rem 1rem;
        border: 1px solid var(--color-warning);
        border-radius: .5rem;
        background: var(--color-warning-soft);
        color: var(--color-warning);
        font-size: .9rem;
        line-height: 1.45;

        &_body {
            @extend %grid_stack;
            gap: .3rem;

            strong {
                font-weight: 700;
            }

            ul {
                margin: 0;
                padding-left: 1.25rem;
            }
        }

        &_close {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 0;
            flex-shrink: 0;
            line-height: 1;

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
        @extend %grid_stack;
        gap: .75rem;
        padding-top: .75rem;
        border-top: 1px solid var(--color-border);

        p {
            margin: 0;
            color: var(--color-muted);
            font-weight: 700;
        }

        &_row {
            @extend %fx_between_center;
            gap: 1rem;
            min-width: 0;
        }

        &_actions {
            @extend %fx_inline_center;
            gap: .5rem;
            flex-wrap: wrap;
        }
    }

    &_invalid_notice {
        display: flex;
        align-items: flex-start;
        gap: .65rem;
        width: min(44rem, 100%);
        justify-self: center;
        min-width: 0;
        padding: .7rem .85rem;
        border: 1px solid color-mix(in srgb, var(--color-danger) 58%, var(--color-border));
        border-radius: .5rem;
        background: color-mix(in srgb, var(--color-danger) 9%, var(--color-surface));
        color: var(--color-text);

        &_icon {
            @extend %grid_center;
            flex: 0 0 auto;
            width: 2rem;
            height: 2rem;
            border-radius: .45rem;
            background: color-mix(in srgb, var(--color-danger) 13%, transparent);
            color: var(--color-danger);

            img {
                width: 1rem;
                height: 1rem;
            }
        }

        &_copy {
            @extend %grid_stack;
            gap: .15rem;
            min-width: 0;

            strong {
                color: var(--color-danger);
                font-size: .9rem;
                line-height: 1.25;
            }

            span {
                color: var(--color-muted);
                font-size: .82rem;
                font-weight: 600;
                line-height: 1.4;
            }
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

        &:disabled .item_button_icon {
            color: currentColor;
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
        flex: 0 0 auto;
        color: currentColor;
        fill: currentColor;
    }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
    .item_view_footer_row {
        align-items: stretch;
        flex-direction: column;
    }

    .item_view_invalid_notice {
        flex-basis: auto;
    }
}

</style>
