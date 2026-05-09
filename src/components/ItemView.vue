<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import PreviewTab from '@/components/common/PreviewTab.vue';
import MenuTab from '@/components/common/MenuTab.vue';
import FileDropZone from '@/components/common/FileDropZone.vue';
import { useI18n } from 'vue-i18n';
import { useProjectStore } from '@/stores/project';
import type { AppMode, MenuAction } from '@/types/Icon';

const { t } = useI18n();
const project = useProjectStore();
const { editSourceFileName } = storeToRefs(project);
const iconDropZone = ref<InstanceType<typeof FileDropZone> | null>(null);

const props = defineProps<{
    mode: AppMode;
}>();

const title = computed(() => {
    return props.mode === 'create' ? t('common.createMode') : t('common.editMode');
});

const description = computed(() => {
    return props.mode === 'create' ? t('itemViewCreateDesc') : t('itemViewEditDesc');
});

const isEditLocked = computed(() => {
    return props.mode === 'edit' && !editSourceFileName.value;
});

function handleEditSourceFiles(files: File[]): void {
    const [file] = files;

    if (file) {
        project.setEditSourceFile(file);
    }
}

function handleIconFiles(files: File[]): void {
    project.addFiles(files);
}

function handleMenuAction(action: MenuAction): void {
    if (action === 'add') {
        iconDropZone.value?.openFilePicker();
        return;
    }

    if (action === 'delete') {
        project.removeSelectedIcon();
        return;
    }

    project.clearIcons();
}

</script>


<template>

    <div class="item_view">
        <button type="button" class="back_button" @click.prevent="project.goHome">
            <img class="ui_icon back_button__icon themed_icon" src="@/assets/icons/back.svg" alt="" />
            {{ t('common.backHome') }}
        </button>

        <header class="item_view__header">
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>
        </header>

        <FileDropZone
            v-if="props.mode === 'edit'"
            :title="t('editSourceTitle')"
            :description="project.editSourceFileName ?? t('editSourceEmpty')"
            :button-text="t('common.chooseExistingFile')"
            accept=".dll,.json"
            @files="handleEditSourceFiles"
        />

        <FileDropZone
            v-if="!isEditLocked"
            ref="iconDropZone"
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
                :can-delete="project.icons.length > 0"
                :can-clear="project.icons.length > 0"
                @action="handleMenuAction"
            />

            <PreviewTab
                :items="project.icons"
                :selected-id="project.selectedIconId"
                @select="project.selectIcon"
                @delete="project.removeIcon"
            />
        </div>

        <footer v-if="!isEditLocked" class="item_view__footer">
            <p>{{ t('itemCount', { count: project.icons.length }) }}</p>
            
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
@use '@/styles/partials/placeholders' as *;

.item_view {
    width: min(1080px, 100%);
    @extend %grid_stack;
    gap: 1.25rem;
}

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
}

.back_button__icon {
    width: 1rem;
    height: 1rem;
}

.item_view__header {
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

.item_view_content {
    @extend %grid_stack;
    gap: .75rem;
}

.item_view__footer {
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

@media (max-width: 760px) {
    .item_view__footer {
        align-items: stretch;
        flex-direction: column;
    }
}

</style>
