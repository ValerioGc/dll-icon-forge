<script lang="ts" setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import HomeView from '@/views/HomeView.vue';
import PageFooter from '@/components/layout/PageFooter.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useI18n } from 'vue-i18n';

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
    if (project.dirty) 
        event.preventDefault();
}

async function registerCloseRequested(): Promise<void> {
    try {
        unlistenCloseRequested = await getCurrentWindow().onCloseRequested((event) => {
            if (isClosingWindow.value) {
                project.cleanupPreviews();
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
