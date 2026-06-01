import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useProjectStore } from '@/stores/project';

export function useConfirmDialogs() {
    const { t } = useI18n();
    const project = useProjectStore();
    const { selectedCount } = storeToRefs(project);

    const showConfirmDelete = ref(false);
    const showConfirmReset = ref(false);

    const deleteConfirmMessage = computed(() =>
        selectedCount.value === 1
            ? t('confirm.deleteSingle')
            : t('confirm.deleteMultiple', { count: selectedCount.value }),
    );

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

    return {
        showConfirmDelete,
        showConfirmReset,
        deleteConfirmMessage,
        handleDeleteClick,
        handleConfirmDelete,
        handleConfirmReset,
    };
}
