<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import SiteBackground from './SiteBackground.vue'
</script>

<template>
  <DefaultTheme.Layout>
    <template #layout-top>
      <SiteBackground />
    </template>
  </DefaultTheme.Layout>
</template>
