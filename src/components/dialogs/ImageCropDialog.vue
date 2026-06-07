<script lang="ts" setup>

import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SquareCropper from '@/components/crop/SquareCropper.vue';
import checkIcon from '@/assets/icons/actions/check.svg';
import closeIcon from '@/assets/icons/actions/close.svg';

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

const cropperRef = ref<InstanceType<typeof SquareCropper> | null>(null);

async function handleApply(): Promise<void> {
    const data = await cropperRef.value?.exportCrop();
    if (!data)
        return;
    emit('confirm', props.iconId, data, props.iconName);
}

</script>

<template>
    <Teleport to="body">
        <div class="crop_overlay" @click.self="emit('cancel')">
            <dialog class="crop_dialog" open aria-modal="true" :aria-label="t('crop.title')" @cancel.prevent="emit('cancel')">
                <h2 class="crop_dialog_title">{{ t('crop.title') }}</h2>
                <p class="crop_dialog_hint">{{ t('crop.hint') }}</p>

                <div class="crop_dialog_canvas">
                    <SquareCropper ref="cropperRef"
                        :src="previewSrc"
                        :alt="iconName"
                        :max-display-size="520"
                    />
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
                        <img class="ui_icon crop_dialog_apply_icon" :src="checkIcon" alt="" aria-hidden="true" />
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
        border-radius: .4rem;
        background: var(--color-placeholder);
        margin-bottom: 1.25rem;
        overflow: hidden;
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

    &_apply_icon {
        filter: var(--icon-on-accent-filter);
    }
}

</style>
