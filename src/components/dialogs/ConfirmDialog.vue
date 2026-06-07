<script setup lang="ts">

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import checkIcon from '@/assets/icons/actions/check.svg';
import closeIcon from '@/assets/icons/actions/close.svg';

const { t } = useI18n();

defineOptions({
    name: 'ConfirmDialog',
});

const props = defineProps<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
}>();

const emit = defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
}>();

const confirmButtonLabel = computed(() => props.confirmLabel ?? t('confirm.confirmLabel'));
const cancelButtonLabel = computed(() => props.cancelLabel ?? t('confirm.cancelLabel'));

</script>

<template>
    <Teleport to="body">
        <div class="confirm_overlay" @click.self="emit('cancel')">
            <dialog class="confirm_dialog" open aria-modal="true" :aria-label="title" @cancel.prevent="emit('cancel')">
                <h2 class="confirm_dialog_title">{{ title }}</h2>
                <p class="confirm_dialog_message">{{ message }}</p>
                
                <div class="confirm_dialog_actions">
                    <button type="button"
                        class="action_button confirm_dialog_icon_button"
                        :aria-label="cancelButtonLabel"
                        :title="cancelButtonLabel"
                        @click="emit('cancel')"
                    >
                        <img class="ui_icon themed_icon" :src="closeIcon" alt="" aria-hidden="true" />
                    </button>
                    <button type="button"
                        class="action_button confirm_dialog_icon_button confirm_dialog_btn_confirm"
                        :aria-label="confirmButtonLabel"
                        :title="confirmButtonLabel"
                        @click="emit('confirm')"
                    >
                        <img class="ui_icon confirm_dialog_confirm_icon" :src="checkIcon" alt="" aria-hidden="true" />
                    </button>
                </div>
            </dialog>
        </div>
    </Teleport>
</template>

<style lang="scss" scoped>

.confirm_overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.confirm_dialog {
    position: static;
    margin: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: .5rem;
    padding: 1.5rem;
    max-width: 420px;
    width: 90%;
    box-shadow: var(--shadow-medium);
    color: var(--color-text);

    &_title {
        margin: 0 0 .5rem;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--color-heading);
    }

    &_message {
        margin: 0 0 1.25rem;
        color: var(--color-muted);
        line-height: 1.55;
    }

    &_actions {
        display: flex;
        justify-content: flex-end;
        gap: .65rem;
    }

    &_icon_button {
        width: 2.5rem;
        height: 2.5rem;
        justify-content: center;
        padding: 0;
    }

    &_btn_confirm {
        border-color: var(--color-accent);
        background: var(--color-accent);
        color: var(--color-on-accent);

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            background: var(--color-accent-hover);
            border-color: var(--color-accent-hover);
            outline: none;
        }

        .confirm_dialog_confirm_icon { filter: var(--icon-on-accent-filter); }
    }
}

</style>
