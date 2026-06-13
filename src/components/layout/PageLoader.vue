<script setup lang="ts">

defineOptions({
    name: 'PageLoader',
});

</script>

<template>
    <div class="page_loader" role="status" aria-live="polite">
        <span class="page_loader_spinner" aria-hidden="true"></span>
    </div>
</template>

<style lang="scss" scoped>

.page_loader {
    @extend %fx_center;
    width: min(1080px, 100%);
    min-height: 18rem;
}

.page_loader_spinner {
    width: 2.75rem;
    height: 2.75rem;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin .8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

</style>
