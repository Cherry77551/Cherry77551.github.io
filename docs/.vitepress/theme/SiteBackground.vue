<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { homeConfig } from './home.config'

const images = computed(() => (homeConfig.backgroundImages || []).filter(Boolean))
/** 0 = 不盖遮罩(内置渐变背景用);换成照片后调到 0.24 左右 */
const veil = computed(() => Number(homeConfig.backgroundVeil ?? 0))
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

    <div class="site-bg__veil" :style="{ opacity: veil }" />
    <div class="site-bg__tint" :style="{ opacity: veil > 0 ? 0.3 : 0 }" />
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

/* 照片上盖一层磨砂白,保证上面的卡片和文字看得清。
   数值越小,背景的四色越明显 —— 0.20 左右比较平衡 */
.site-bg__veil {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
}

/* 缓慢流动的绿色渐变,以 color 模式叠上去给整站统一色调。
   用自己照片时靠它把色调拉齐;不需要就写 opacity: 0 */
.site-bg__tint {
  position: absolute;
  inset: 0;
  opacity: 0.3;
  mix-blend-mode: color;
  background: linear-gradient(-45deg, #d6f0ef, #a2dccf, #f7c9d4, #a2dccf);
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

/* 两个柔光斑,给背景加点层次 —— 颜色取自四种配色 */
.site-bg__blob--a {
  top: -14%;
  left: -12%;
  background: rgba(247, 201, 212, 0.55);
}

.site-bg__blob--b {
  right: -12%;
  bottom: -14%;
  background: rgba(46, 125, 107, 0.22);
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
