
<script setup lang="ts">
import { computed } from 'vue';
import logoUrl from '@/assets/logo.png';
import darkIcon from '@/assets/icons/dark.svg';
import lightIcon from '@/assets/icons/light.svg';
import LanguageButton from '@/components/common/LanguageButton.vue';
import { useSettingsStore } from '@/stores/settings';

const emit = defineEmits<{
    (e: 'home'): void;
}>();

const settings = useSettingsStore();
const themeImg = computed(() => {
    return settings.theme === 'light'
        ? darkIcon
        : lightIcon;
});
</script>

<template>
    <nav class="page_header">
        <button type="button" class="page_header__brand" aria-label="Win DLL Packer" @click.prevent="emit('home')">
            <img class="ui_icon page_header__logo" :src="logoUrl" alt="">
        </button>
        <div class="page_header__actions">
            <LanguageButton />
            
            <button type="button"
                class="page_header__button action_button"
                :aria-label="$t('common.toggleTheme')"
                @click.prevent="settings.toggleTheme"
            >
                <img class="ui_icon themed_icon" :src="themeImg" alt="" />
            </button>
        </div>
    </nav>
</template>

<style lang="scss" scoped>
    @use '@/styles/partials/placeholders' as *;

    .page_header {
        @extend %fx_between_center;
        gap: 1rem;
        padding: .8rem clamp(1rem, 3vw, 2rem);
        border-bottom: 1px solid var(--color-border);
        background-color: var(--color-header-background);
        backdrop-filter: blur(16px);
    }

    .page_header__brand {
        @extend %fx_center;
        width: 2.75rem;
        height: 2.75rem;
        padding: 0;
        border: 0;
        border-radius: .6rem;
        background: transparent;
        cursor: pointer;
    }

    .page_header__logo {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: .5rem;
        background: var(--color-placeholder);
    }

    .page_header__actions {
        @extend %fx_start_center;
        gap: .5rem;
    }

    .page_header__button {
        @extend %header_control;
    }
</style>
