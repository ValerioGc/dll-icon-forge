<script setup lang="ts">

import { ref, onMounted, onBeforeUnmount } from 'vue';
import chevronDown from '@/assets/icons/chevron-down.svg';
import itFlag from '@/assets/flags/it.svg';
import enFlag from '@/assets/flags/en.svg';
import frFlag from '@/assets/flags/fr.svg';
import esFlag from '@/assets/flags/es.svg';
import deFlag from '@/assets/flags/de.svg';
import { useSettingsStore } from '@/stores/settings';
import { SUPPORTED_LOCALES, type AppLocale } from '@/i18n';

const settings = useSettingsStore();

const FLAGS: Record<AppLocale, string> = {
    it: itFlag,
    en: enFlag,
    fr: frFlag,
    es: esFlag,
    de: deFlag,
};

const LANGUAGE_NAMES: Record<AppLocale, string> = {
    it: 'Italiano',
    en: 'English',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
};

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function selectLocale(locale: AppLocale): void {
    settings.setLanguage(locale);
    open.value = false;
}

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
            <img class="ui_icon" :src="FLAGS[settings.language]" :alt="settings.language.toUpperCase()" />
            <span>{{ settings.language.toUpperCase() }}</span>
            <img
                class="ui_icon themed_icon language_selector__chevron"
                :class="{ 'language_selector__chevron--open': open }"
                :src="chevronDown"
                alt=""
            />
        </button>

        <ul v-if="open" class="language_selector__dropdown" role="listbox">
            <li
                v-for="locale in SUPPORTED_LOCALES"
                :key="locale"
                role="option"
                :aria-selected="settings.language === locale"
                class="language_selector__option"
                :class="{ 'language_selector__option--active': settings.language === locale }"
                @click="selectLocale(locale)"
            >
                <img class="ui_icon" :src="FLAGS[locale]" :alt="locale.toUpperCase()" />
                <span>{{ LANGUAGE_NAMES[locale] }}</span>
            </li>
        </ul>
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

    &__dropdown {
        position: absolute;
        top: calc(100% + .4rem);
        right: 0;
        min-width: 10rem;
        padding: .3rem;
        margin: 0;
        list-style: none;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: .45rem;
        box-shadow: var(--shadow-soft);
        z-index: 50;
    }

    &__option {
        @extend %fx_start_center;
        gap: .5rem;
        padding: .45rem .65rem;
        border-radius: .3rem;
        cursor: pointer;
        font-size: .875rem;
        color: var(--color-text);
        transition: background .1s ease;

        &:hover {
            background: var(--color-accent-soft);
        }

        &--active {
            color: var(--color-accent);
            font-weight: 600;
        }
    }
}

</style>
