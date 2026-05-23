<script setup lang="ts">
import logoUrl from '@/assets/logo.svg';
import LanguageButton from '@/components/buttons/LanguageButton.vue';
import ThemeButton from '@/components/buttons/ThemeButton.vue';
import TitleBar from '@/components/layout/TitleBar.vue';

const emit = defineEmits<{
    (e: 'home'): void;
}>();
</script>

<template>
    <header class="page_header">
        <button type="button" class="page_header__brand" aria-label="DLL Icon Forge" @click.prevent="emit('home')">
            <img class="page_header__logo" :src="logoUrl" alt="">
        </button>

        <div class="page_header__right" data-tauri-drag-region>
            <TitleBar />
            <div class="page_header__actions">
                <LanguageButton />
                <ThemeButton />
            </div>
        </div>
    </header>
</template>

<style lang="scss" scoped>

    .page_header {
        position: sticky;
        top: 0;
        z-index: 100;
        display: flex;
        align-items: stretch;
        border-bottom: 1px solid var(--color-border);
        background-color: var(--color-header-background);
        backdrop-filter: blur(16px);

        &__brand {
            @extend %fx_center;
            flex-shrink: 0;
            padding: 0.75rem clamp(0.75rem, 2vw, 1.25rem);
            border: none;
            background: transparent;
            cursor: pointer;
            border-radius: 0;
        }

        &__logo {
            width: 3.5rem;
            height: 3.5rem;
            border-radius: 0.6rem;
            object-fit: contain;
        }

        &__right {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-width: 0;
        }

        &__actions {
            @extend %fx_start_center;
            justify-content: flex-end;
            gap: 0.5rem;
            padding: 0.4rem 0.75rem 0.5rem;
        }
    }

</style>
