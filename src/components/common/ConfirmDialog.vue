<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
}>();

const emit = defineEmits<{
    (e: 'confirm'): void;
    (e: 'cancel'): void;
}>();
</script>

<template>
    <Teleport to="body">
        <div class="confirm_overlay" @click.self="emit('cancel')">
            <div class="confirm_dialog" role="dialog" aria-modal="true" :aria-label="title">
                <h2 class="confirm_dialog_title">{{ title }}</h2>
                <p class="confirm_dialog_message">{{ message }}</p>
                <div class="confirm_dialog_actions">
                    <button type="button" class="action_button" @click="emit('cancel')">
                        {{ cancelLabel ?? t('confirm.cancelLabel') }}
                    </button>
                    <button type="button" class="action_button confirm_dialog_btn_confirm" @click="emit('confirm')">
                        {{ confirmLabel ?? t('confirm.confirmLabel') }}
                    </button>
                </div>
            </div>
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
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: .5rem;
    padding: 1.5rem;
    max-width: 420px;
    width: 90%;
    box-shadow: var(--shadow-medium);

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

    &_btn_confirm {
        border-color: var(--color-danger);
        color: var(--color-danger);

        &:hover:not(:disabled),
        &:focus-visible:not(:disabled) {
            background: var(--color-danger);
            border-color: var(--color-danger);
            color: #fff;
            outline: none;
        }
    }
}

</style>
