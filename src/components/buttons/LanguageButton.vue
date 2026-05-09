<script setup lang="ts">

import { computed } from 'vue';
import enFlag from '@/assets/flags/en.svg';
import itFlag from '@/assets/flags/it.svg';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();

const localeImg = computed(() => {
    return settings.language === 'en'
        ? enFlag
        : itFlag;
});

</script>

<template>
    <button type="button"
        class="language_button action_button"
        :aria-label="$t('common.toggleLocale')"
        @click.prevent="settings.toggleLanguage"
    >
        <img class="ui_icon" :src="localeImg" :alt="settings.language.toUpperCase()" />
        <span>{{ settings.language.toUpperCase() }}</span>
    </button>
</template>

<style lang="scss" scoped>

.language_button {
    @extend %header_control;
}

</style>
