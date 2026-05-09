<script setup lang="ts">

import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import IconCollectionView from '@/components/explorer/IconCollectionView.vue';
import MenuTab from '@/components/explorer/MenuTab.vue';
import FileDropZone from '@/components/common/FileDropZone.vue';

import { useProjectStore } from '@/stores/project';
import type { ProjectMode } from '@/types/Project';

const { t } = useI18n();
const project = useProjectStore();
const { sourceLabel, selectedCount, icons } = storeToRefs(project);

const props = defineProps<{
    mode: ProjectMode;
}>();

const title = computed(() => {
    return props.mode === 'create' ? t('common.createMode') : t('common.editMode');
});

const description = computed(() => {
    return props.mode === 'create' ? t('itemViewCreateDesc') : t('itemViewEditDesc');
});

const isEditLocked = computed(() => {
    return props.mode === 'edit' && sourceLabel.value === null;
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

function handleEditSourceFiles(files: File[]): void {
    const [file] = files;

    if (file)
        project.setEditSourceFile(file);
}

function handleIconFiles(files: File[]): void {
    project.addFiles(files);
}

function handleDelete(): void {
    project.removeSelectedIcons();
}

</script>

<template>
    <div class="item_view">
        <button type="button" class="back_button" @click.prevent="project.goHome">
            <img class="ui_icon back_button_icon themed_icon" src="@/assets/icons/back.svg" alt="" />
            {{ t('common.backHome') }}
        </button>

        <header class="item_view_header">
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>
        </header>

        <FileDropZone v-if="props.mode === 'edit'"
            :title="t('editSourceTitle')"
            :description="project.sourceLabel ?? t('editSourceEmpty')"
            :button-text="t('common.chooseExistingFile')"
            accept=".dll,.json"
            @files="handleEditSourceFiles"
        />

        <FileDropZone v-if="!isEditLocked"
            :title="t('dropZoneTitle')"
            :description="t('dropZoneDesc')"
            :button-text="t('common.chooseFile')"
            accept=".ico,.png,.jpg,.jpeg,.bmp,image/png,image/jpeg,image/bmp,image/x-icon"
            multiple
            primary
            @files="handleIconFiles"
        />

        <div v-if="!isEditLocked" class="item_view_content">
            <MenuTab
                :selected-count="selectedCount"
                @delete="handleDelete"
            />

            <IconCollectionView />
        </div>

        <footer v-if="!isEditLocked" class="item_view_footer">
            <p>{{ itemCountLabel }}</p>

            <button type="button"
                class="item_button item_button--primary"
                :disabled="!project.canBuild"
                :aria-disabled="!project.canBuild"
                @click.prevent="project.submitProject"
            >
                <img class="ui_icon themed_icon" src="@/assets/icons/save.svg" alt="" />
                {{ t('common.submit') }}
            </button>
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
    background: transparent;
    border-radius: 6px;
    padding: .5rem;
    color: var(--color-muted);
    font-weight: 700;
    cursor: pointer;

    &:hover,
    &:focus-visible {
        color: var(--color-text);
        outline: none;
    }

    &_icon {
        width: 1rem;
        height: 1rem;
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
    }
}

@media (max-width: 760px) {
    .item_view_footer {
        align-items: stretch;
        flex-direction: column;
    }
}

</style>
