<script setup lang="ts">
import { computed, defineAsyncComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue';
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

const clickOpen = ref(false);
const hoverOpen = ref(false);
const hasOpened = ref(false);
const root = ref<HTMLElement | null>(null);
const currentFlag = ref('');
let flagRequest = 0;

const isOpen = computed(() => clickOpen.value || hoverOpen.value);

function selectLocale(locale: AppLocale): void {
    settings.setLanguage(locale);
    clickOpen.value = false;
    hoverOpen.value = false;
}

function toggleClickOpen(): void {
    clickOpen.value = !clickOpen.value;
    if (clickOpen.value) {
        hasOpened.value = true;
    }
}

function handleMouseEnter(): void {
    hoverOpen.value = true;
    hasOpened.value = true;
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
        clickOpen.value = false;
        hoverOpen.value = false;
    }
}

function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        clickOpen.value = false;
        hoverOpen.value = false;
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
    <div
        class="language_selector"
        ref="root"
        @mouseenter="handleMouseEnter"
        @mouseleave="hoverOpen = false"
    >
        <button
            type="button"
            class="language_selector__trigger action_button"
            :aria-label="$t('common.toggleLocale')"
            :aria-expanded="isOpen"
            @click="toggleClickOpen"
        >
            <img v-if="currentFlag" class="ui_icon" :src="currentFlag" :alt="settings.language.toUpperCase()" />
            <span>{{ settings.language.toUpperCase() }}</span>
            <img
                class="ui_icon themed_icon language_selector__chevron"
                :class="{ 'language_selector__chevron--open': isOpen }"
                :src="chevronDown"
                alt=""
            />
        </button>

        <div v-if="hasOpened" v-show="isOpen" class="language_selector__dropdown_shell">
            <LanguageDropdown
                :selected-locale="settings.language"
                @select="selectLocale"
            />
        </div>
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

    &__dropdown_shell {
        position: absolute;
        top: calc(100% + .4rem);
        right: 0;
        z-index: 50;
    }
}
</style>
