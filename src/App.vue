<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue';
import HomeView from '@/components/HomeView.vue';
import ItemView from '@/components/ItemView.vue';
import PageFooter from '@/components/layout/PageFooter.vue';
import PageHeader from '@/components/layout/PageHeader.vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';

const project = useProjectStore();
const settings = useSettingsStore();

settings.load();

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (project.dirty) {
    event.preventDefault();
  }
}

onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload));
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload));

</script>

<template>
    <div class="app">
        <PageHeader @home="project.goHome" />
        <main class="app__content">
            <HomeView v-if="project.mode === null" @select-mode="project.setMode" />
            <ItemView v-else :mode="project.mode" />
        </main>
        <PageFooter />
    </div>
</template>
