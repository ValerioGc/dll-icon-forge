<script lang="ts" setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import HomeView from '@/views/HomeView.vue';
import PageFooter from '@/components/layout/PageFooter.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useI18n } from 'vue-i18n';
import backIcon from '@/assets/icons/navigation/back.svg';

const ItemView = defineAsyncComponent(() => import('@/views/ItemView.vue'));
const ConfirmDialog = defineAsyncComponent(() => import('@/components/dialogs/ConfirmDialog.vue'));

const { t } = useI18n();
const project = useProjectStore();
const settings = useSettingsStore(); 

settings.load();

const showConfirmHome = ref(false);
const showConfirmClose = ref(false);
const isClosingWindow = ref(false);
let unlistenCloseRequested: (() => void) | null = null;

function handleGoHome(): void {
    if (project.dirty) {
        showConfirmHome.value = true;
    } else {
        project.cleanupPreviews();
        project.goHome();
    }
}

function confirmGoHome(): void {
    showConfirmHome.value = false;
    project.cleanupPreviews();
    project.goHome();
}

async function confirmClose(): Promise<void> {
    showConfirmClose.value = false;
    isClosingWindow.value = true;
    await project.cleanupPreviews();

    try {
        await getCurrentWindow().close();
    } catch {
        window.close();
    }
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (project.dirty && !isClosingWindow.value)
        event.preventDefault();
}

async function registerCloseRequested(): Promise<void> {
    try {
        unlistenCloseRequested = await getCurrentWindow().onCloseRequested((event) => {
            if (isClosingWindow.value) {
                return;
            }

            if (project.dirty) {
                event.preventDefault();
                showConfirmClose.value = true;
                return;
            }

            project.cleanupPreviews();
        });
    } catch {
        unlistenCloseRequested = null;
    }
}

onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    registerCloseRequested();
});
onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    unlistenCloseRequested?.();
});

</script>

<template>
    <div class="app">
        <PageHeader @home="handleGoHome" />
        <nav v-if="project.mode !== null" class="app__topbar">
            <button type="button" class="back_button" @click="handleGoHome">
                <img class="back_button_icon" :src="backIcon" alt="" aria-hidden="true" />
                {{ t('common.backHome') }}
            </button>
        </nav>
        <main class="app__content">
            <HomeView v-if="project.mode === null" @select-mode="project.setMode" />
            <ItemView v-else :mode="project.mode" @home="handleGoHome" />
        </main>
        <PageFooter />

        <ConfirmDialog
            v-if="showConfirmHome"
            :title="t('confirm.unsavedTitle')"
            :message="t('confirm.unsavedMessage')"
            @confirm="confirmGoHome"
            @cancel="showConfirmHome = false"
        />

        <ConfirmDialog
            v-if="showConfirmClose"
            :title="t('confirm.unsavedTitle')"
            :message="t('confirm.unsavedMessage')"
            @confirm="confirmClose"
            @cancel="showConfirmClose = false"
        />
    </div>
</template>

<style lang="scss" scoped>

.app__topbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: .4rem clamp(.75rem, 2vw, 1.25rem);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-header-background);
    backdrop-filter: blur(16px);
}

.back_button {
    @extend %fx_inline_center;
    gap: .5rem;
    width: max-content;
    min-height: 2.25rem;
    border-radius: 6px;
    padding: .4rem .75rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid var(--color-accent);
    background: var(--color-accent);
    color: var(--color-on-accent);
    transition:
        border-color .16s ease,
        background .16s ease,
        transform .16s ease;

    &:hover,
    &:focus-visible {
        border-color: var(--color-accent-hover);
        background: var(--color-accent-hover);
        outline: none;
    }

    &:active {
        transform: translateY(1px);
    }
}

.back_button_icon {
    width: 1.25rem;
    height: 1.25rem;
    filter: var(--icon-on-accent-filter);
    pointer-events: none;
}

</style>
