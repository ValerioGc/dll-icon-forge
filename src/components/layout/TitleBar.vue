<script setup lang="ts">

import { ref, onMounted, onUnmounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import minimizeIcon from '@/assets/icons/minus.svg';
import maximizeIcon from '@/assets/icons/square.svg';
import closeIcon from '@/assets/icons/actions/close.svg';

let win: ReturnType<typeof getCurrentWindow> | null = null;
try { 
    win = getCurrentWindow(); 
} catch { 
    /* browser fallback */ 
}

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
    } catch { 
        /* browser fallback */ 
    }
});

onUnmounted(() => {
    unlistenResized?.();
});

</script>

<template>
    <div class="titlebar" data-tauri-drag-region>
        <div class="titlebar__controls" data-tauri-no-drag>
            <button
                class="titlebar__btn titlebar__btn--minimize"
                type="button"
                aria-label="Minimize"
                @click="minimize"
            >
                <img class="titlebar__icon" :src="minimizeIcon" alt="" aria-hidden="true" />
            </button>

            <button
                class="titlebar__btn titlebar__btn--maximize"
                type="button"
                :aria-label="isMaximized ? 'Restore' : 'Maximize'"
                @click="toggleMaximize"
                @dblclick.stop
            >
                <img class="titlebar__icon" :src="maximizeIcon" alt="" aria-hidden="true" />
            </button>

            <button
                class="titlebar__btn titlebar__btn--close"
                type="button"
                aria-label="Close"
                @click="close"
            >
                <img class="titlebar__icon" :src="closeIcon" alt="" aria-hidden="true" />
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
            cursor: pointer;
            padding: 0;
            transition: background-color 0.1s;

            &:hover {
                background-color: var(--color-placeholder);
            }

            &--close:hover {
                background-color: var(--color-danger);

                .titlebar__icon {
                    filter: brightness(0) invert(1);
                }
            }
        }

        &__icon {
            width: 10px;
            height: 10px;
            filter: var(--icon-filter);
            pointer-events: none;
        }
    }

</style>
