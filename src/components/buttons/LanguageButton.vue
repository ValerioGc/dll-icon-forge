<script setup lang="ts">
import { defineAsyncComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import chevronDown from '@/assets/icons/navigation/chevron-down.svg';
import { useSettingsStore } from '@/stores/settings';
import type { AppLocale } from '@/i18n';

const settings = useSettingsStore();
const LanguageDropdown = defineAsyncComponent(() => import('@/components/buttons/LanguageDropdown.vue'));

const FLAG_LOADERS: Record<AppLocale, () => Promise<{ default: string }>> = {
    it: () => import('@/assets/flags/it.svg'),
    en: () => import('@/assets/flags/en.svg'),
    fr: () => import('@/assets/flags/fr.svg'),
    es: () => import('@/assets/flags/es.svg'),
    de: () => import('@/assets/flags/de.svg'),
};

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const currentFlag = ref('');
let flagRequest = 0;

function selectLocale(locale: AppLocale): void {
    settings.setLanguage(locale);
    open.value = false;
}

watch(
    () => settings.language,
    async (locale) => {
        const request = ++flagRequest;
        const flag = await FLAG_LOADERS[locale]();

        if (request === flagRequest) {
            currentFlag.value = flag.default;
        }
    },
    { immediate: true },
);

function handleOutsideClick(event: MouseEvent): void {
    if (root.value && !root.value.contains(event.target as Node)) {
        open.value = false;
    }
}

function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        open.value = false;
    }
}

onMounted(() => {
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
    <div class="language_selector" ref="root">
        <button
            type="button"
            class="language_selector__trigger action_button"
            :aria-label="$t('common.toggleLocale')"
            :aria-expanded="open"
            @click="open = !open"
        >
            <img v-if="currentFlag" class="ui_icon" :src="currentFlag" :alt="settings.language.toUpperCase()" />
            <span>{{ settings.language.toUpperCase() }}</span>
            <img
                class="ui_icon themed_icon language_selector__chevron"
                :class="{ 'language_selector__chevron--open': open }"
                :src="chevronDown"
                alt=""
            />
        </button>

        <LanguageDropdown
            v-if="open"
            :selected-locale="settings.language"
            @select="selectLocale"
        />
    </div>
</template>

<style lang="scss" scoped>
.language_selector {
    position: relative;

    &__trigger {
        @extend %header_control;
    }

    &__chevron {
        width: 1rem;
        height: 1rem;
        transition: transform .15s ease;

        &--open {
            transform: rotate(180deg);
        }
    }
}
</style>
