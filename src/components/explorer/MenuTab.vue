<script lang="ts" setup>

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import cropIcon from '@/assets/icons/actions/scissors.svg';
import trash from '@/assets/icons/actions/trash.svg';

const { t } = useI18n();

const props = withDefaults(defineProps<{
    selectedCount?: number;
    disabled?: boolean;
}>(), {
    selectedCount: 0,
    disabled: false,
});

const emit = defineEmits<{
    (e: 'delete'): void;
    (e: 'edit'): void;
}>();

const isDisabled = computed(() => props.disabled || props.selectedCount === 0);
const isEditDisabled = computed(() => props.disabled || props.selectedCount !== 1);

const deleteLabel = computed(() => {
    return props.selectedCount > 0
        ? t('menu.deleteWithCount', { count: props.selectedCount })
        : t('menu.delete');
});

</script>

<template>
    <div class="menu_tab surface">
        <ul>
            <li>
                <button type="button" class="menu_button action_button"
                    :disabled="isEditDisabled"
                    @click.prevent="emit('edit')"
                >
                    <img class="ui_icon themed_icon" :src="cropIcon" alt="" aria-hidden="true" />
                    {{ t('menu.crop') }}
                </button>
            </li>
            <li>
                <button type="button" class="menu_button action_button"
                    :disabled="isDisabled"
                    @click.prevent="emit('delete')"
                >
                    <img class="ui_icon themed_icon" :src="trash" alt="" aria-hidden="true" />
                    {{ deleteLabel }}
                </button>
            </li>
        </ul>
    </div>
</template>

<style lang="scss" scoped>

    ul {
        @extend %fx_start_center;
        list-style: none;
        margin: 0;
        padding: .5rem;
        gap: .5rem;
        flex-wrap: wrap;
    }

    .menu_button {
        min-height: 2.25rem;
        padding: 0 .85rem;
        font-weight: 700;
    }
    
</style>
