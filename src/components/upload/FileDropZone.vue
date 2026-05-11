<script setup lang="ts">

import { ref } from 'vue';
import uploadIcon from '@/assets/icons/actions/upload.svg';

let nextInputId = 0;

const props = withDefaults(defineProps<{
    title: string;
    description: string;
    buttonText: string;
    accept: string;
    multiple?: boolean;
    primary?: boolean;
    disabled?: boolean;
    nativePicker?: boolean;
}>(), {
    multiple: false,
    primary: false,
    disabled: false,
    nativePicker: false,
});

const emit = defineEmits<{
    (event: 'files', files: File[]): void;
    (event: 'browse'): void;
}>();

const input = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const inputId = `file-drop-zone-input-${++nextInputId}`;
const inputName = `${inputId}-file`;

function openFilePicker(): void {
    if (props.disabled)
        return;

    if (props.nativePicker) {
        emit('browse');
        return;
    }

    input.value?.click();
}

defineExpose({
    openFilePicker,
});

function emitFiles(files: FileList | File[]): void {
    const selectedFiles = Array.from(files);

    if (selectedFiles.length === 0)
        return;

    emit('files', props.multiple ? selectedFiles : selectedFiles.slice(0, 1));
}

function handleFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;

    if (target.files) 
        emitFiles(target.files);

    target.value = '';
}

function handleDragState(dragging: boolean): void {
    if (!props.disabled) 
        isDragging.value = dragging;
}

function handleDrop(event: DragEvent): void {
    handleDragState(false);

    if (props.disabled || !event.dataTransfer?.files.length) 
        return;

    emitFiles(event.dataTransfer.files);
}

</script>

<template>
    <div
        class="file_drop_zone"
        :class="{
            'file_drop_zone--active': isDragging,
            'file_drop_zone--disabled': disabled,
        }"
        @dragenter.prevent="handleDragState(true)"
        @dragover.prevent="handleDragState(true)"
        @dragleave.prevent="handleDragState(false)"
        @drop.prevent="handleDrop"
    >
        <div class="file_drop_zone_copy">
            <strong>{{ title }}</strong>
            <span>{{ description }}</span>
        </div>

        <button class="file_drop_zone_button action_button"
            type="button"
            :class="{ 'file_drop_zone_button--primary': primary }"
            :disabled="disabled"
            @click.prevent="openFilePicker"
        >
            <img class="ui_icon themed_icon" :class="{ invert: primary }" :src="uploadIcon" alt="">
            {{ buttonText }}
        </button>

        <input ref="input"
            :id="inputId"
            :name="inputName"
            type="file"
            class="file_drop_zone_input"
            :accept="accept"
            :multiple="multiple"
            :disabled="disabled"
            @change="handleFileChange"
        />
    </div>
</template>

<style lang="scss" scoped>

.file_drop_zone {
    @extend %fx_between_center;
    gap: 1rem;
    min-height: 7.5rem;
    padding: 1.25rem;
    border: 1px dashed var(--color-border-strong);
    border-radius: .5rem;
    background: var(--color-surface);

    &--active {
        border-color: var(--color-accent);
        background: var(--color-accent-soft);
    }

    &--disabled {
        opacity: .55;
        pointer-events: none;
    }

    &_copy {
        @extend %grid_stack;
        gap: .35rem;

        strong {
            color: var(--color-text);
        }

        span {
            color: var(--color-muted);
        }
    }

    &_button {
        min-height: 2.65rem;
        gap: .5rem;
        padding: 0 1rem;
        border-radius: .45rem;
        font-weight: 800;
        transition: border-color .16s ease, background .16s ease, opacity .16s ease;

        &:disabled {
            opacity: .5;
        }
        
        &--primary {
            border-color: var(--color-accent);
            background: var(--color-accent);
            color: #ffffff;
            
            &:hover:not(:disabled),
            &:focus-visible:not(:disabled) {
                background: var(--color-accent-hover);
            }
        }
    }

    &_input {
        @extend %visually_hidden;
    }
}

.invert {
    filter: invert(1);
}

@media (max-width: 760px) {
    .file_drop_zone {
        align-items: stretch;
        flex-direction: column;
    }
}

</style>
