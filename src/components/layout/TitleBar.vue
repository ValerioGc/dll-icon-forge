<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';

let win: ReturnType<typeof getCurrentWindow> | null = null;
try { win = getCurrentWindow(); } catch { /* browser fallback */ }

const isMaximized = ref(false);
let unlistenResized: (() => void) | null = null;

async function syncMaximized(): Promise<void> {
    try { isMaximized.value = (await win?.isMaximized()) ?? false; } catch { /* browser fallback */ }
}

async function minimize(): Promise<void> {
    try { await win?.minimize(); } catch { /* browser fallback */ }
}

async function toggleMaximize(): Promise<void> {
    try { await win?.toggleMaximize(); } catch { /* browser fallback */ }
}

async function close(): Promise<void> {
    try { await win?.close(); } catch { /* browser fallback */ }
}

onMounted(async () => {
    await syncMaximized();
    try {
        if (win) unlistenResized = await win.onResized(syncMaximized);
    } catch { /* browser fallback */ }
});

onUnmounted(() => {
    unlistenResized?.();
});
</script>

<template>
    <div class="titlebar" data-tauri-drag-region>
        <div class="titlebar__controls">
            <button
                class="titlebar__btn titlebar__btn--minimize"
                type="button"
                aria-label="Minimize"
                @click="minimize"
            >
                <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden="true" fill="currentColor">
                    <rect width="10" height="1" />
                </svg>
            </button>

            <button
                class="titlebar__btn titlebar__btn--maximize"
                type="button"
                :aria-label="isMaximized ? 'Restore' : 'Maximize'"
                @click="toggleMaximize"
                @dblclick.stop
            >
                <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2">
                    <rect x=".6" y=".6" width="8.8" height="8.8" />
                </svg>
                <svg v-else width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2">
                    <polyline points="3,0 10,0 10,7" />
                    <rect x="0" y="3" width="7" height="7" />
                </svg>
            </button>

            <button
                class="titlebar__btn titlebar__btn--close"
                type="button"
                aria-label="Close"
                @click="close"
            >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
                    <line x1="0" y1="0" x2="10" y2="10" />
                    <line x1="10" y1="0" x2="0" y2="10" />
                </svg>
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped>

    .titlebar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        height: 32px;
        background-color: var(--color-header-background);
        backdrop-filter: blur(16px);
        user-select: none;
        -webkit-user-select: none;

        &__controls {
            display: flex;
            align-items: stretch;
            height: 100%;
        }

        &__btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 46px;
            height: 100%;
            border: none;
            background: transparent;
            color: var(--color-text);
            cursor: pointer;
            padding: 0;
            transition: background-color 0.1s;

            &:hover {
                background-color: var(--color-placeholder);
            }

            &--close:hover {
                background-color: var(--color-danger);
                color: #ffffff;
            }
        }
    }

</style>
