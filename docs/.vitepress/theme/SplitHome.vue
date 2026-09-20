<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { site, theme } = useData()

const title = computed(() => site.value.title)
const nav = computed(() => (theme.value.nav ?? []).filter((i: any) => i.link))

const panels = [
  { text: '笔记', sub: '学习记录与技术整理', link: '/notes/' },
  { text: '项目', sub: '做过的东西与源码', link: '/projects/' },
]
</script>

<template>
  <div class="home">
    <div class="home__bloom" aria-hidden="true"></div>

    <header class="home__bar">
      <a class="home__brand" :href="withBase('/')">
        <span class="home__mark" aria-hidden="true"></span>
        <span>{{ title }}</span>
      </a>
      <nav class="home__nav">
        <a v-for="item in nav" :key="item.link" :href="withBase(item.link)">{{ item.text }}</a>
      </nav>
    </header>

    <main class="home__main">
      <a
        v-for="panel in panels"
        :key="panel.link"
        class="card"
        :href="withBase(panel.link)"
      >
        <span class="card__body">
          <span class="card__text">{{ panel.text }}</span>
          <span class="card__sub">{{ panel.sub }}</span>
        </span>
        <svg class="card__arrow" viewBox="0 0 48 18" aria-hidden="true">
          <path
            d="M1 9h43M36 2l7 7-7 7"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
    </main>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow: hidden;
}

/* 背景里那朵很淡的山茶花 */
.home__bloom {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(80vw, 560px);
  aspect-ratio: 1;
  transform: translate(-50%, -48%);
  background: url('/camellia.svg') center / contain no-repeat;
  opacity: 0.06;
  pointer-events: none;
}

.home__bar {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: 60px;
  padding: 0 28px;
}

.home__brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: color 0.25s;
}

.home__brand:hover {
  color: var(--vp-c-brand-1);
}

.home__mark {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  background: url('/camellia.svg') center / contain no-repeat;
}

.home__nav {
  display: flex;
  gap: 22px;
}

.home__nav a {
  font-size: 14px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.25s;
}

.home__nav a:hover {
  color: var(--vp-c-brand-1);
}

/* 两块入口:居中、上下排列 */
.home__main {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 32px 24px 96px;
}

.card {
  width: 100%;
  max-width: 430px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 30px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background-color: color-mix(in srgb, var(--vp-c-bg) 76%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  text-decoration: none;
  transition: border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  border-color: var(--vp-c-brand-3);
  transform: translateY(-3px);
  box-shadow: 0 10px 28px -14px rgba(63, 157, 109, 0.5);
}

.card__body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.card__text {
  font-size: clamp(1.6rem, 4.5vw, 2.25rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-1);
  transition: color 0.3s ease;
}

.card:hover .card__text {
  color: var(--vp-c-brand-1);
}

.card__sub {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
}

.card__arrow {
  flex: 0 0 auto;
  width: 34px;
  height: auto;
  color: var(--vp-c-brand-1);
  opacity: 0.4;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
}

.card:hover .card__arrow {
  transform: translateX(6px);
  opacity: 1;
}

@media (max-width: 640px) {
  .home__bar {
    height: 52px;
    padding: 0 18px;
  }

  .home__nav {
    gap: 14px;
  }

  .home__main {
    gap: 14px;
    padding: 24px 18px 72px;
  }

  .card {
    padding: 20px 22px;
  }

  .card__arrow {
    width: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card__text,
  .card__arrow {
    transition: none;
  }
}
</style>
