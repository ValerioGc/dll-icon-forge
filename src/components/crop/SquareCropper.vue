<script lang="ts" setup>

import { computed, onUnmounted, ref, watch } from 'vue';

defineOptions({ name: 'SquareCropper' });

type DragMode = 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw';

interface CropSelection {
    x: number;
    y: number;
    size: number;
}

interface DragStart {
    mode: DragMode;
    pointerX: number;
    pointerY: number;
    selection: CropSelection;
}

const props = withDefaults(defineProps<{
    src: string;
    alt?: string;
    maxDisplaySize?: number;
    initialCoverage?: number;
    minSelectionSize?: number;
    outputType?: string;
}>(), {
    alt: '',
    maxDisplaySize: 520,
    initialCoverage: .9,
    minSelectionSize: 24,
    outputType: 'image/png',
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasSize = ref({ width: 0, height: 0 });
const selection = ref<CropSelection>({ x: 0, y: 0, size: 0 });
const isReady = ref(false);
const isDragging = ref(false);

let sourceImage: HTMLImageElement | null = null;
let dragStart: DragStart | null = null;
let loadToken = 0;

const stageStyle = computed(() => ({
    '--crop-stage-width': `${canvasSize.value.width}px`,
    '--crop-stage-height': `${canvasSize.value.height}px`,
}));

const selectionStyle = computed(() => {
    const { width, height } = canvasSize.value;
    if (width === 0 || height === 0)
        return {};

    return {
        left: `${(selection.value.x / width) * 100}%`,
        top: `${(selection.value.y / height) * 100}%`,
        width: `${(selection.value.size / width) * 100}%`,
        height: `${(selection.value.size / height) * 100}%`,
    };
});

watch(
    () => props.src,
    () => {
        void loadImage();
    },
    { immediate: true },
);

onUnmounted(() => {
    stopDrag();
    sourceImage = null;
});

async function loadImage(): Promise<void> {
    const token = ++loadToken;
    isReady.value = false;
    stopDrag();

    const image = await createImage(props.src).catch(() => null);
    if (!image || token !== loadToken)
        return;

    sourceImage = image;
    const size = fitImageSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
    canvasSize.value = size;

    await Promise.resolve();
    renderImage();
    resetSelection();
    isReady.value = true;
}

function createImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Image load failed'));
        image.src = src;
    });
}

function fitImageSize(width: number, height: number): { width: number; height: number } {
    const largestSide = Math.max(width, height, 1);
    const scale = Math.min(1, props.maxDisplaySize / largestSide);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

function renderImage(): void {
    const canvas = canvasRef.value;
    if (!canvas || !sourceImage)
        return;

    canvas.width = canvasSize.value.width;
    canvas.height = canvasSize.value.height;

    const context = canvas.getContext('2d');
    if (!context)
        return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
}

function resetSelection(): void {
    const { width, height } = canvasSize.value;
    const size = Math.min(width, height) * clampNumber(props.initialCoverage, .1, 1);
    selection.value = {
        x: (width - size) / 2,
        y: (height - size) / 2,
        size,
    };
}

function startDrag(mode: DragMode, event: PointerEvent): void {
    if (!isReady.value)
        return;

    event.preventDefault();
    const pointer = pointerToCanvas(event);
    dragStart = {
        mode,
        pointerX: pointer.x,
        pointerY: pointer.y,
        selection: { ...selection.value },
    };
    isDragging.value = true;
    globalThis.addEventListener('pointermove', updateDrag);
    globalThis.addEventListener('pointerup', stopDrag, { once: true });
}

function updateDrag(event: PointerEvent): void {
    if (!dragStart)
        return;

    event.preventDefault();
    const pointer = pointerToCanvas(event);
    const dx = pointer.x - dragStart.pointerX;
    const dy = pointer.y - dragStart.pointerY;

    if (dragStart.mode === 'move') {
        selection.value = clampSelection({
            ...dragStart.selection,
            x: dragStart.selection.x + dx,
            y: dragStart.selection.y + dy,
        });
        return;
    }

    selection.value = resizeSelection(dragStart, dx, dy);
}

function stopDrag(): void {
    globalThis.removeEventListener('pointermove', updateDrag);
    globalThis.removeEventListener('pointerup', stopDrag);
    dragStart = null;
    isDragging.value = false;
}

function pointerToCanvas(event: PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.value;
    if (!canvas)
        return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * canvas.width,
        y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * canvas.height,
    };
}

function resizeSelection(start: DragStart, dx: number, dy: number): CropSelection {
    const { mode, selection: initial } = start;
    const delta = getResizeDelta(mode, dx, dy);
    const maxSize = getResizeMaxSize(mode, initial);
    const size = clampNumber(initial.size + delta, props.minSelectionSize, maxSize);

    if (mode === 'resize-se')
        return clampSelection({ x: initial.x, y: initial.y, size });
    if (mode === 'resize-sw')
        return clampSelection({ x: initial.x + initial.size - size, y: initial.y, size });
    if (mode === 'resize-ne')
        return clampSelection({ x: initial.x, y: initial.y + initial.size - size, size });
    return clampSelection({
        x: initial.x + initial.size - size,
        y: initial.y + initial.size - size,
        size,
    });
}

function getResizeDelta(mode: DragMode, dx: number, dy: number): number {
    if (mode === 'resize-se')
        return Math.max(dx, dy);
    if (mode === 'resize-sw')
        return Math.max(-dx, dy);
    if (mode === 'resize-ne')
        return Math.max(dx, -dy);
    return Math.max(-dx, -dy);
}

function getResizeMaxSize(mode: DragMode, initial: CropSelection): number {
    const { width, height } = canvasSize.value;
    if (mode === 'resize-se')
        return Math.min(width - initial.x, height - initial.y);
    if (mode === 'resize-sw')
        return Math.min(initial.x + initial.size, height - initial.y);
    if (mode === 'resize-ne')
        return Math.min(width - initial.x, initial.y + initial.size);
    return Math.min(initial.x + initial.size, initial.y + initial.size);
}

function clampSelection(next: CropSelection): CropSelection {
    const { width, height } = canvasSize.value;
    const maxSize = Math.min(width, height);
    const size = clampNumber(next.size, props.minSelectionSize, maxSize);
    return {
        x: clampNumber(next.x, 0, width - size),
        y: clampNumber(next.y, 0, height - size),
        size,
    };
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

async function exportCrop(): Promise<Uint8Array | null> {
    if (!sourceImage || !isReady.value)
        return null;

    const { x, y, size } = selection.value;
    const sourceScaleX = (sourceImage.naturalWidth || sourceImage.width) / canvasSize.value.width;
    const sourceScaleY = (sourceImage.naturalHeight || sourceImage.height) / canvasSize.value.height;
    const sourceX = Math.round(x * sourceScaleX);
    const sourceY = Math.round(y * sourceScaleY);
    const sourceSize = Math.max(1, Math.round(size * Math.min(sourceScaleX, sourceScaleY)));

    const output = document.createElement('canvas');
    output.width = sourceSize;
    output.height = sourceSize;

    const context = output.getContext('2d');
    if (!context)
        return null;

    context.drawImage(
        sourceImage,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        sourceSize,
        sourceSize,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
        output.toBlob(resolve, props.outputType);
    });
    if (!blob)
        return null;

    return new Uint8Array(await blob.arrayBuffer());
}

defineExpose({
    exportCrop,
    resetSelection,
    selection,
});

</script>

<template>
    <div class="square_cropper"
        :class="{ 'is-ready': isReady, 'is-dragging': isDragging }"
        :style="stageStyle"
    >
        <canvas ref="canvasRef"
            class="square_cropper_canvas"
            :aria-label="alt"
        ></canvas>

        <div v-if="isReady"
            class="square_cropper_selection"
            :style="selectionStyle"
            @pointerdown.stop="startDrag('move', $event)"
        >
            <span class="square_cropper_grid" aria-hidden="true"></span>
            <span class="square_cropper_handle square_cropper_handle--nw" @pointerdown.stop="startDrag('resize-nw', $event)"></span>
            <span class="square_cropper_handle square_cropper_handle--ne" @pointerdown.stop="startDrag('resize-ne', $event)"></span>
            <span class="square_cropper_handle square_cropper_handle--sw" @pointerdown.stop="startDrag('resize-sw', $event)"></span>
            <span class="square_cropper_handle square_cropper_handle--se" @pointerdown.stop="startDrag('resize-se', $event)"></span>
        </div>
    </div>
</template>

<style lang="scss" scoped>

.square_cropper {
    position: relative;
    width: min(100%, var(--crop-stage-width));
    height: var(--crop-stage-height);
    max-height: 58vh;
    margin: 0 auto;
    overflow: hidden;
    border-radius: .45rem;
    background: var(--color-placeholder);
    touch-action: none;

    &_canvas {
        display: block;
        width: 100%;
        height: 100%;
        user-select: none;
    }

    &_selection {
        position: absolute;
        border: 2px solid var(--color-accent);
        box-shadow: 0 0 0 999px rgba(0, 0, 0, .42);
        cursor: move;
    }

    &_grid {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(to right, transparent 33.333%, rgba(255, 255, 255, .55) 33.333%, rgba(255, 255, 255, .55) calc(33.333% + 1px), transparent calc(33.333% + 1px), transparent 66.666%, rgba(255, 255, 255, .55) 66.666%, rgba(255, 255, 255, .55) calc(66.666% + 1px), transparent calc(66.666% + 1px)),
            linear-gradient(to bottom, transparent 33.333%, rgba(255, 255, 255, .55) 33.333%, rgba(255, 255, 255, .55) calc(33.333% + 1px), transparent calc(33.333% + 1px), transparent 66.666%, rgba(255, 255, 255, .55) 66.666%, rgba(255, 255, 255, .55) calc(66.666% + 1px), transparent calc(66.666% + 1px));
        pointer-events: none;
    }

    &_handle {
        position: absolute;
        width: .8rem;
        height: .8rem;
        border: 2px solid #ffffff;
        border-radius: 50%;
        background: var(--color-accent);
        box-shadow: 0 1px 4px rgba(0, 0, 0, .28);

        &--nw {
            top: -.45rem;
            left: -.45rem;
            cursor: nwse-resize;
        }

        &--ne {
            top: -.45rem;
            right: -.45rem;
            cursor: nesw-resize;
        }

        &--sw {
            bottom: -.45rem;
            left: -.45rem;
            cursor: nesw-resize;
        }

        &--se {
            right: -.45rem;
            bottom: -.45rem;
            cursor: nwse-resize;
        }
    }

    &.is-dragging &_selection {
        border-color: var(--color-accent-hover);
    }
}

</style>
