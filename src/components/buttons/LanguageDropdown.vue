<script setup lang="ts">
import itFlag from '@/assets/flags/it.svg';
import enFlag from '@/assets/flags/en.svg';
import frFlag from '@/assets/flags/fr.svg';
import esFlag from '@/assets/flags/es.svg';
import deFlag from '@/assets/flags/de.svg';
import { SUPPORTED_LOCALES, type AppLocale } from '@/i18n';

defineOptions({
    name: 'LanguageDropdown',
});

defineProps<{
    selectedLocale: AppLocale;
}>();

const emit = defineEmits<{
    (e: 'select', locale: AppLocale): void;
}>();

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
</script>

<template>
    <ul class="language_selector__dropdown">
        <li
            v-for="locale in SUPPORTED_LOCALES"
            :key="locale"
            class="language_selector__option_item"
        >
            <button
                type="button"
                class="language_selector__option"
                :class="{ 'language_selector__option--active': selectedLocale === locale }"
                @click="emit('select', locale)"
            >
                <img class="ui_icon" :src="FLAGS[locale]" :alt="locale.toUpperCase()" />
                <span>{{ LANGUAGE_NAMES[locale] }}</span>
            </button>
        </li>
    </ul>
</template>

<style lang="scss" scoped>
.language_selector {
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
        width: 100%;
        gap: .5rem;
        padding: .45rem .65rem;
        border: 0;
        border-radius: .3rem;
        background: transparent;
        cursor: pointer;
        font-size: .875rem;
        color: var(--color-text);
        font-family: inherit;
        text-align: left;
        transition: background .1s ease;

        &:hover,
        &:focus-visible {
            background: var(--color-accent-soft);
            outline: none;
        }

        &--active {
            color: var(--color-accent);
            font-weight: 600;
        }
    }
}
</style>
