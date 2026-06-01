<script lang="ts" setup>

import { onMounted, onUnmounted, ref } from 'vue';
import Cropper from 'cropperjs';
import { useI18n } from 'vue-i18n';
import closeIcon from '@/assets/icons/actions/close.svg';
import saveIcon from '@/assets/icons/actions/save.svg';

defineOptions({ name: 'ImageCropDialog' });

const { t } = useI18n();

const props = defineProps<{
    iconId: string;
    previewSrc: string;
    iconName: string;
}>();

const emit = defineEmits<{
    (e: 'confirm', iconId: string, data: Uint8Array, name: string): void;
    (e: 'cancel'): void;
}>();

// Template with aspect-ratio="1" locked on the selection element.
const CROP_TEMPLATE = [
    '<cropper-canvas background>',
    '<cropper-image rotatable scalable skewable translatable></cropper-image>',
    '<cropper-shade hidden></cropper-shade>',
    '<cropper-handle action="select" plain></cropper-handle>',
    '<cropper-selection aspect-ratio="1" initial-coverage="0.9" movable resizable>',
    '<cropper-grid role="grid" bordered covered></cropper-grid>',
    '<cropper-crosshair centered></cropper-crosshair>',
    '<cropper-handle action="move" theme-color="rgba(255,255,255,0.35)"></cropper-handle>',
    '<cropper-handle action="n-resize"></cropper-handle>',
    '<cropper-handle action="e-resize"></cropper-handle>',
    '<cropper-handle action="s-resize"></cropper-handle>',
    '<cropper-handle action="w-resize"></cropper-handle>',
    '<cropper-handle action="ne-resize"></cropper-handle>',
    '<cropper-handle action="nw-resize"></cropper-handle>',
    '<cropper-handle action="se-resize"></cropper-handle>',
    '<cropper-handle action="sw-resize"></cropper-handle>',
    '</cropper-selection>',
    '</cropper-canvas>',
].join('');

const imgRef = ref<HTMLImageElement | null>(null);
let cropper: Cropper | null = null;

onMounted(() => {
    if (imgRef.value) 
        cropper = new Cropper(imgRef.value, { template: CROP_TEMPLATE });
});

onUnmounted(() => {
    cropper?.destroy();
    cropper = null;
});

async function handleApply(): Promise<void> {
    if (!cropper) 
        return;
    
    const selection = cropper.getCropperSelection();
    if (!selection) 
        return;
    
    const canvas = await selection.$toCanvas();
    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
    });
    if (!blob) 
        return;
    
    const buffer = await blob.arrayBuffer();
    emit('confirm', props.iconId, new Uint8Array(buffer), props.iconName);
}

</script>

<template>
    <Teleport to="body">
        <div class="crop_overlay" @click.self="emit('cancel')">
            <dialog class="crop_dialog" open aria-modal="true" :aria-label="t('crop.title')" @cancel.prevent="emit('cancel')">
                <h2 class="crop_dialog_title">{{ t('crop.title') }}</h2>
                <p class="crop_dialog_hint">{{ t('crop.hint') }}</p>

                <div class="crop_dialog_canvas">
                    <img ref="imgRef" :src="previewSrc" :alt="iconName" />
                </div>

                <div class="crop_dialog_actions">
                    <button type="button"
                        class="action_button crop_dialog_btn"
                        :aria-label="t('confirm.cancelLabel')"
                        :title="t('confirm.cancelLabel')"
                        @click="emit('cancel')"
                    >
                        <img class="ui_icon themed_icon" :src="closeIcon" alt="" aria-hidden="true" />
                    </button>
                    <button type="button"
                        class="action_button crop_dialog_btn crop_dialog_btn_apply"
                        :aria-label="t('crop.apply')"
                        :title="t('crop.apply')"
                        @click="handleApply"
                    >
                        <img class="ui_icon themed_icon" :src="saveIcon" alt="" aria-hidden="true" />
                    </button>
                </div>
            </dialog>
        </div>
    </Teleport>
</template>

<style lang="scss" scoped>

.crop_overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.crop_dialog {
    position: static;
    margin: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: .5rem;
    padding: 1.5rem;
    max-width: 600px;
    width: 90%;
    box-shadow: var(--shadow-medium);
    color: var(--color-text);

    &_title {
        margin: 0 0 .25rem;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--color-heading);
    }

    &_hint {
        margin: 0 0 1rem;
        color: var(--color-muted);
        font-size: .875rem;
        line-height: 1.45;
    }

    &_canvas {
        height: 380px;
        border-radius: .4rem;
        background: var(--color-placeholder);
        margin-bottom: 1.25rem;
        overflow: hidden;

        :deep(cropper-canvas) {
            display: block;
            width: 100%;
            height: 100%;
        }
    }

    &_actions {
        display: flex;
        justify-content: flex-end;
        gap: .65rem;
    }

    &_btn {
        width: 2.5rem;
        height: 2.5rem;
        justify-content: center;
        padding: 0;

        &_apply {
            border-color: var(--color-accent);
            background: var(--color-accent);

            &:hover:not(:disabled),
            &:focus-visible:not(:disabled) {
                border-color: var(--color-accent-hover);
                background: var(--color-accent-hover);
                outline: none;
            }
        }
    }
}

</style>
