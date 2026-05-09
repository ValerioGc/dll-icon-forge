<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MenuAction } from '@/types/Icon';

const { t } = useI18n();

const props = withDefaults(defineProps<{
    canDelete?: boolean;
    canClear?: boolean;
    disabled?: boolean;
}>(), {
    canDelete: false,
    canClear: false,
    disabled: false,
});

const emit = defineEmits<{
    (e: 'action', action: MenuAction): void;
}>();

interface MenuItem {
    name: string;
    action: MenuAction;
    disabled: boolean;
    img: string;
}

import trash from '@/assets/icons/trash.svg';

const items = computed<Array<MenuItem>>(() => [
    {
        name: t('menu.delete'),
        action: 'delete',
        disabled: props.disabled || !props.canDelete,
        img: trash,
    }
]);

</script>

<template>
    <div class="menu_tab surface">
        <ul>
            <li v-for="item in items" :key="item.action">
                <button
                    type="button"
                    class="menu_button action_button"
                    :disabled="item.disabled"
                    @click.prevent="emit('action', item.action)"
                >
                    <img class="ui_icon themed_icon" :src="item.img" alt="" aria-hidden="true" />
                    {{ item.name }}
                </button>
            </li>
        </ul>
    </div>

</template>

<style lang="scss" scoped>
    @use '@/styles/partials/placeholders' as *;

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
