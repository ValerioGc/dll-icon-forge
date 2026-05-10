<script setup lang="ts">

import { computed } from 'vue';
import darkIcon from '@/assets/icons/theme/dark.svg';
import lightIcon from '@/assets/icons/theme/light.svg';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();

const themeImg = computed(() => {
    return settings.theme === 'light'
        ? darkIcon
        : lightIcon;
});
</script>

<template>
    <button type="button" class="page_header_button action_button" :aria-label="$t('common.toggleTheme')"
        @click.prevent="settings.toggleTheme">
        <img class="ui_icon themed_icon" :src="themeImg" alt="" />
    </button>
</template>

<style lang="scss" scoped>
.page_header_button {
    @extend %header_control;
}
</style>
