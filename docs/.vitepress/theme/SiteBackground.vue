<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { homeConfig } from './home.config'

const images = computed(() => (homeConfig.backgroundImages || []).filter(Boolean))
const active = ref(0)
let timer: number | undefined

onMounted(() => {
  if (images.value.length < 2) return
  timer = window.setInterval(() => {
    active.value = (active.value + 1) % images.value.length
  }, 8000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="site-bg" aria-hidden="true">
    <div class="site-bg__photos">
      <div
        v-for="(src, i) in images"
        :key="src + i"
        class="site-bg__photo"
        :class="{ 'is-active': i === active }"
        :style="{ backgroundImage: `url('${src}')` }"
      />
    </div>

    <div class="site-bg__veil" />
    <div class="site-bg__tint" />
    <div class="site-bg__blob site-bg__blob--a" />
    <div class="site-bg__blob site-bg__blob--b" />
  </div>
</template>

<style scoped>
.site-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.site-bg__photos {
  position: absolute;
  inset: 0;
}

.site-bg__photo {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0;
  transition: opacity 2000ms ease-in-out;
  will-change: opacity;
}

.site-bg__photo.is-active {
  opacity: 1;
}

/* 照片上盖一层磨砂白,保证上面的卡片和文字看得清 */
.site-bg__veil {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.32);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
}

/* 缓慢流动的靛紫渐变,以 color 模式叠上去给整站统一色调 */
.site-bg__tint {
  position: absolute;
  inset: 0;
  opacity: 0.55;
  mix-blend-mode: color;
  background: linear-gradient(-45deg, #a18cd1, #fbc2eb, #a1c4fd, #c2e9fb);
  background-size: 400% 400%;
  animation: siteBgMove 15s ease infinite;
}

@keyframes siteBgMove {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.site-bg__blob {
  position: absolute;
  width: 42%;
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(100px);
}

.site-bg__blob--a {
  top: -14%;
  left: -12%;
  background: rgba(255, 255, 255, 0.45);
}

.site-bg__blob--b {
  right: -12%;
  bottom: -14%;
  background: rgba(129, 140, 248, 0.38);
}

@media (prefers-reduced-motion: reduce) {
  .site-bg__tint {
    animation: none;
  }

  .site-bg__photo {
    transition: none;
  }
}
</style>
