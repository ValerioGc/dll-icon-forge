import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '@/stores/project';
import type { ProjectIcon } from '@/types/icons';

export function useCrop() {
    const project = useProjectStore();
    const { icons } = storeToRefs(project);

    const showCropDialog = ref(false);
    const cropTargetIcon = ref<ProjectIcon | null>(null);

    function handleEdit(id: string): void {
        const icon = icons.value.find((i) => i.id === id);
        if (icon) {
            cropTargetIcon.value = icon;
            showCropDialog.value = true;
        }
    }

    async function handleCropConfirm(iconId: string, data: Uint8Array, name: string): Promise<void> {
        showCropDialog.value = false;
        cropTargetIcon.value = null;
        await project.cropIcon(iconId, data, name);
    }

    function handleCropCancel(): void {
        showCropDialog.value = false;
        cropTargetIcon.value = null;
    }

    return { showCropDialog, cropTargetIcon, handleEdit, handleCropConfirm, handleCropCancel };
}
