import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useProjectStore } from '@/stores/project';
import type { ProjectMode } from '@/types/modes';

export function useItemMeta(getMode: () => ProjectMode) {
    const { t } = useI18n();
    const project = useProjectStore();
    const { icons, selectedCount, sourceLabel } = storeToRefs(project);

    const title = computed(() =>
        getMode() === 'create' ? t('common.createMode') : t('common.editMode'),
    );

    const description = computed(() =>
        getMode() === 'create' ? t('itemViewCreateDesc') : t('itemViewEditDesc'),
    );

    const kicker = computed(() =>
        getMode() === 'create' ? t('itemViewCreateKicker') : t('itemViewEditKicker'),
    );

    const highlights = computed(() =>
        getMode() === 'create'
            ? [
                t('itemViewCreateHighlight1'),
                t('itemViewCreateHighlight2'),
                t('itemViewCreateHighlight3'),
            ]
            : [
                t('itemViewEditHighlight1'),
                t('itemViewEditHighlight2'),
                t('itemViewEditHighlight3'),
            ],
    );

    const isEditLocked = computed(() =>
        getMode() === 'edit' && sourceLabel.value === null,
    );

    const itemCountLabel = computed(() => {
        if (selectedCount.value > 0) {
            return t('itemCountWithSelection', {
                count: icons.value.length,
                selected: selectedCount.value,
            });
        }
        return t('itemCount', { count: icons.value.length });
    });

    return { title, description, kicker, highlights, isEditLocked, itemCountLabel };
}
