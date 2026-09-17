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
  <div class="split-home">
    <header class="split-home__bar">
      <a class="split-home__brand" :href="withBase('/')">{{ title }}</a>
      <nav class="split-home__nav">
        <a v-for="item in nav" :key="item.link" :href="withBase(item.link)">{{ item.text }}</a>
      </nav>
    </header>

    <main class="split-home__panels">
      <a
        v-for="panel in panels"
        :key="panel.link"
        class="split-panel"
        :href="withBase(panel.link)"
      >
        <span class="split-panel__row">
          <span class="split-panel__text">{{ panel.text }}</span>
          <svg class="split-panel__arrow" viewBox="0 0 48 18" aria-hidden="true">
            <path
              d="M1 9h43M36 2l7 7-7 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="split-panel__sub">{{ panel.sub }}</span>
      </a>
    </main>
  </div>
</template>

<style scoped>
.split-home {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.split-home__bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: 60px;
  padding: 0 28px;
}

.split-home__brand {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: color 0.25s;
}

.split-home__brand:hover {
  color: var(--vp-c-brand-1);
}

.split-home__nav {
  display: flex;
  gap: 22px;
}

.split-home__nav a {
  font-size: 14px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.25s;
}

.split-home__nav a:hover {
  color: var(--vp-c-brand-1);
}

.split-home__panels {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
  gap: 1px;
  background-color: var(--vp-c-divider);
  border-top: 1px solid var(--vp-c-divider);
}

.split-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px clamp(28px, 6vw, 88px);
  text-decoration: none;
  background-color: color-mix(in srgb, var(--vp-c-bg) 55%, transparent);
  overflow: hidden;
}

.split-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 20%, var(--vp-c-brand-soft));
  opacity: 0;
  transition: opacity 0.4s ease;
}

.split-panel:hover::before {
  opacity: 1;
}

.split-panel__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: clamp(14px, 2.5vw, 32px);
}

.split-panel__text {
  font-size: clamp(3rem, 7.5vw, 6rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-1);
  transition: color 0.3s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.split-panel:hover .split-panel__text {
  color: var(--vp-c-brand-1);
  transform: translateX(8px);
}

.split-panel__arrow {
  flex: 0 0 auto;
  width: clamp(38px, 5vw, 74px);
  height: auto;
  color: var(--vp-c-brand-1);
  opacity: 0.45;
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
}

.split-panel:hover .split-panel__arrow {
  transform: translateX(14px);
  opacity: 1;
}

.split-panel__sub {
  position: relative;
  margin-top: 18px;
  font-size: 14px;
  letter-spacing: 0.14em;
  color: var(--vp-c-text-3);
  transition: color 0.3s ease;
}

.split-panel:hover .split-panel__sub {
  color: var(--vp-c-text-2);
}

@media (max-width: 767px) {
  .split-home__bar {
    height: 52px;
    padding: 0 20px;
  }

  .split-home__nav {
    gap: 16px;
  }

  .split-home__panels {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .split-panel {
    padding: 32px 24px;
  }

  .split-panel__sub {
    margin-top: 12px;
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .split-panel__text,
  .split-panel__arrow,
  .split-panel::before {
    transition: none;
  }
}
</style>
