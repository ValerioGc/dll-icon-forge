<script setup lang="ts">

import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const appVersion = import.meta.env.VITE_APP_VERSION ?? 'undefined';
const githubUrl = import.meta.env.VITE_GITHUB_URL ?? 'https://github.com/ValerioGc/dll-icon-forge';

</script>

<template>
    <footer class="page_footer">
        <div class="page_footer_inner">
            <p>{{ t('footerText', { version: appVersion }) }}</p>

            <a :href="githubUrl" target="_blank" rel="noreferrer">
                {{ t('footerGithub') }}
            </a>
        </div>
    </footer>
</template>

<style lang="scss" scoped>

.page_footer {
    padding: 0 clamp(1rem, 3vw, 2rem) 1rem;
    color: var(--color-muted);

    &_inner {
        @extend %fx_center;
        min-height: 3.25rem;
        gap: .75rem;
        padding: .75rem 1rem;
        border: 1px solid var(--color-border);
        border-radius: .5rem;
        background: var(--color-header-background);
        backdrop-filter: blur(16px);
        box-shadow: var(--shadow-soft);
        font-size: .84rem;
        font-weight: 700;
    }
}

p {
    margin: 0;
    text-align: center;
}

a {
    color: var(--color-accent);
    text-decoration: none;

    &::before {
        content: "|";
        margin-right: .75rem;
        color: var(--color-border-strong);
    }

    &:hover,
    &:focus-visible {
        color: var(--color-accent-hover);
        text-decoration: underline;
        outline: none;
    }
}

@media (max-width: 720px) {
    .page_footer__inner {
        flex-wrap: wrap;
    }

    p {
        text-align: center;
    }
}

</style>
