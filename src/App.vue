<script lang="ts" setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import HomeView from '@/views/HomeView.vue';
import PageFooter from '@/components/layout/PageFooter.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { useI18n } from 'vue-i18n';

const ItemView = defineAsyncComponent(() => import('@/views/ItemView.vue'));
const ConfirmDialog = defineAsyncComponent(() => import('@/components/dialogs/ConfirmDialog.vue'));

const { t } = useI18n();
const project = useProjectStore();
const settings = useSettingsStore();

settings.load();

const showConfirmHome = ref(false);

function handleGoHome(): void {
    if (project.dirty) {
        showConfirmHome.value = true;
    } else {
        project.goHome();
    }
}

function confirmGoHome(): void {
    showConfirmHome.value = false;
    project.goHome();
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (project.dirty) {
        event.preventDefault();
    }
}

// close-requested Tauri (@tauri-apps/plugin-window) rimandato a sez. 8
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload));
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload));

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
    </div>
</template>
