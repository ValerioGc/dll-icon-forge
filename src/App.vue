<script lang="ts" setup>
import HomeView from '@/components/HomeView.vue';
import ItemView from '@/components/ItemView.vue';
import PageFooter from '@/components/common/PageFooter.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';

const project = useProjectStore();
const settings = useSettingsStore();

settings.load();
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
