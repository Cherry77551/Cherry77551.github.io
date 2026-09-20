<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { site, theme } = useData()

const title = computed(() => site.value.title)
const nav = computed(() => (theme.value.nav ?? []).filter((i: any) => i.link))

const panels = [
  { text: '笔记', sub: '学习记录与技术整理', link: '/notes/', tone: 'green' },
  { text: '项目', sub: '做过的东西与源码', link: '/projects/', tone: 'mint' },
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
      <div class="home__welcome">
        <span class="home__badge" aria-hidden="true"></span>
        <p class="home__hello">今天想看点什么?</p>
      </div>

      <a
        v-for="panel in panels"
        :key="panel.link"
        class="card"
        :href="withBase(panel.link)"
      >
        <span class="card__icon" :class="`card__icon--${panel.tone}`" aria-hidden="true">
          <svg v-if="panel.tone === 'green'" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="4.5" />
            <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="2.5" />
            <rect x="13" y="13" width="8" height="8" rx="2.5" />
            <path d="M13 7h3.5A4.5 4.5 0 0 1 21 11.5V13" />
          </svg>
        </span>

        <span class="card__body">
          <span class="card__text">{{ panel.text }}</span>
          <span class="card__sub">{{ panel.sub }}</span>
        </span>

        <span class="card__arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
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
  width: min(78vw, 520px);
  aspect-ratio: 1;
  transform: translate(-50%, -48%);
  background: url('/camellia.svg') center / contain no-repeat;
  opacity: 0.05;
  pointer-events: none;
}

/* ---------------- 顶栏 ---------------- */
.home__bar {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: 68px;
  padding: 0 28px;
  background-color: var(--k-surface);
  border-bottom: 2px solid var(--k-border);
}

.home__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 600;
  color: var(--k-text);
  text-decoration: none;
  transition: color var(--k-dur) var(--k-ease);
}

.home__brand:hover {
  color: var(--k-green-deep);
}

.home__mark {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  background: url('/camellia.svg') center / contain no-repeat;
  transition: transform var(--k-dur) var(--k-ease);
}

.home__brand:hover .home__mark {
  transform: scale(1.15, 0.92);
}

.home__nav {
  display: flex;
  gap: 6px;
}

.home__nav a {
  padding: 7px 16px;
  border-radius: var(--k-r-full);
  font-size: 14px;
  font-weight: 500;
  color: var(--k-text-2);
  text-decoration: none;
  transition: background-color var(--k-dur) var(--k-ease),
    color var(--k-dur) var(--k-ease), transform var(--k-dur) var(--k-ease);
}

.home__nav a:hover {
  color: var(--k-green-deep);
  background-color: rgba(167, 224, 191, 0.35);
  transform: scale(1.06, 1.12);
}

.home__nav a:active {
  transform: scale(0.94);
}

/* ---------------- 主体 ---------------- */
.home__main {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 40px 24px 104px;
}

.home__welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

/* 山茶花放在一个粉彩圆底里 */
.home__badge {
  width: 82px;
  height: 82px;
  border-radius: var(--k-r-full);
  background-color: var(--k-green);
  background-image: url('/camellia.svg');
  background-repeat: no-repeat;
  background-position: center;
  background-size: 58px 58px;
  box-shadow: var(--k-shadow-md);
}

.home__hello {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--k-text-2);
}

/* ---------------- 卡片 ---------------- */
.card {
  width: 100%;
  max-width: 460px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 22px 24px;
  border: 2px solid var(--k-border);
  border-radius: var(--k-r);
  background-color: var(--k-surface);
  box-shadow: var(--k-shadow-md);
  text-decoration: none;
  transition: transform var(--k-dur) var(--k-ease),
    box-shadow var(--k-dur) var(--k-ease),
    border-color var(--k-dur) var(--k-ease);
}

/* Cloud Lift + 果冻微挤压 */
.card:hover {
  border-color: var(--k-border-strong);
  box-shadow: var(--k-shadow-lg);
  transform: translateY(-6px) scale(1.022, 1.04);
}

.card:active {
  transform: translateY(-1px) scale(0.955);
  box-shadow: var(--k-shadow-sm);
}

.card__icon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: var(--k-r-full);
  color: #1d5f40;
  transition: transform var(--k-dur) var(--k-ease);
}

.card__icon svg {
  width: 27px;
  height: 27px;
}

.card__icon--green {
  background-color: var(--k-green);
}

.card__icon--mint {
  background-color: var(--k-mint);
}

/* 图标做挤压回弹,文字不动 —— 软糯感主要来自这里 */
.card:hover .card__icon {
  transform: scale(1.14, 0.9);
}

.card:active .card__icon {
  transform: scale(0.88, 1.08);
}

.card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
}

.card__text {
  font-size: clamp(1.45rem, 4vw, 1.9rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.06em;
  color: var(--k-text);
  transition: color var(--k-dur) var(--k-ease);
}

.card:hover .card__text {
  color: var(--k-green-deep);
}

.card__sub {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--k-text-3);
}

.card__arrow {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--k-r-full);
  background-color: rgba(167, 224, 191, 0.4);
  color: var(--k-green-deep);
  transition: transform var(--k-dur) var(--k-ease),
    background-color var(--k-dur) var(--k-ease);
}

.card__arrow svg {
  width: 19px;
  height: 19px;
}

.card:hover .card__arrow {
  background-color: var(--k-green);
  transform: translateX(5px) scale(1.08, 0.95);
}

/* ---------------- 窄屏 ---------------- */
@media (max-width: 640px) {
  .home__bar {
    height: 58px;
    padding: 0 16px;
    gap: 12px;
  }

  .home__nav {
    gap: 2px;
  }

  .home__nav a {
    padding: 6px 10px;
    font-size: 13px;
  }

  .home__main {
    gap: 14px;
    padding: 28px 18px 76px;
  }

  .home__badge {
    width: 68px;
    height: 68px;
    background-size: 48px 48px;
  }

  .card {
    gap: 14px;
    padding: 18px 18px;
  }

  .card__icon {
    width: 46px;
    height: 46px;
  }

  .card__icon svg {
    width: 23px;
    height: 23px;
  }

  .card__arrow {
    width: 32px;
    height: 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card__icon,
  .card__arrow,
  .home__mark,
  .home__nav a {
    transition: none;
  }

  .card:hover,
  .card:active,
  .card:hover .card__icon,
  .card:active .card__icon,
  .card:hover .card__arrow,
  .home__nav a:hover,
  .home__brand:hover .home__mark {
    transform: none;
  }
}
</style>
