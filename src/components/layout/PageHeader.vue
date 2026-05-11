<script setup lang="ts">

import logoUrl from '@/assets/logo.svg';
import LanguageButton from '@/components/buttons/LanguageButton.vue';
import ThemeButton from '@/components/buttons/ThemeButton.vue';

const emit = defineEmits<{
    (e: 'home'): void;
}>();

</script>

<template>
    <nav class="page_header">
        <button type="button" class="page_header_brand" aria-label="DLL Icon Forge" @click.prevent="emit('home')">
            <img class="ui_icon page_header_logo" :src="logoUrl" alt="">
        </button>

        <div class="page_header_actions">

            <LanguageButton />
            
            <ThemeButton />
        </div>
    </nav>
</template>

<style lang="scss" scoped>

    .page_header {
        @extend %fx_between_center;
        gap: 1rem;
        padding: .8rem clamp(1rem, 3vw, 2rem);
        border-bottom: 1px solid var(--color-border);
        background-color: var(--color-header-background);
        backdrop-filter: blur(16px);

        &_brand {
            @extend %fx_center;
            width: 2.75rem;
            height: 2.75rem;
            padding: 0;
            border: 0;
            border-radius: .6rem;
            cursor: pointer;
        }

        &_logo {
            width: 2.75rem;
            height: 2.75rem;
            border-radius: .5rem;
        }

        &_actions {
            @extend %fx_start_center;
            gap: .5rem;
        }
    }

</style>
