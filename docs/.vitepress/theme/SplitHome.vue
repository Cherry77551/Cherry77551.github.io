<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { homeConfig } from './home.config'
import SiteBackground from './SiteBackground.vue'

const { site, theme } = useData()

const title = computed(() => site.value.title)
const nav = computed(() => (theme.value.nav ?? []).filter((i: any) => i.link))

const profile = homeConfig.profile
const entries = homeConfig.entries
const statusBar = homeConfig.statusBar

const initial = computed(() => (profile.name || '?').trim().charAt(0))

/* 没上传封面图时,用这四色轮着做渐变兜底 */
const gradientPairs = [
  ['#c98b92', '#a2dccf'],
  ['#a2dccf', '#d6f0ef'],
  ['#f7c9d4', '#c98b92'],
  ['#d6f0ef', '#a2dccf'],
  ['#c98b92', '#f7c9d4'],
]

function entryStyle(i: number) {
  const [from, to] = gradientPairs[i % gradientPairs.length]
  return {
    '--entry-from': from,
    '--entry-to': to,
  } as Record<string, string>
}
</script>

<template>
  <div class="home">
    <SiteBackground />

    <!-- ---------------- 顶栏 ---------------- -->
    <header class="hdr">
      <div class="hdr__inner">
        <a class="hdr__brand" :href="withBase('/')">{{ title }}</a>
        <nav class="hdr__nav">
          <a
            v-for="item in nav"
            :key="item.link"
            :href="withBase(item.link)"
            :class="{ 'is-active': withBase(item.link) === withBase('/') }"
          >
            {{ item.text }}
          </a>
        </nav>
      </div>
    </header>

    <main class="main">
      <div class="grid">
        <!-- ---------------- 个人卡片 ---------------- -->
        <section class="card card--profile">
          <div class="profile">
            <div class="profile__avatar">
              <img v-if="profile.avatar" :src="withBase(profile.avatar)" :alt="profile.name" />
              <span v-else class="profile__initial">{{ initial }}</span>
            </div>

            <div class="profile__text">
              <h1 class="profile__name">{{ profile.name }}</h1>
              <p class="profile__bio">{{ profile.bio }}</p>
            </div>
          </div>

          <div v-if="profile.stats?.length" class="stats">
            <template v-for="(s, i) in profile.stats" :key="s.label">
              <span v-if="i > 0" class="stats__sep" aria-hidden="true" />
              <span class="stats__item">
                <b class="stats__value">{{ s.value }}</b>
                <i class="stats__label">{{ s.label }}</i>
              </span>
            </template>
          </div>

          <div v-if="profile.links?.length" class="links">
            <a
              v-for="l in profile.links"
              :key="l.href"
              class="links__btn"
              :href="l.href"
              target="_blank"
              rel="noopener noreferrer"
              :title="l.label"
              :aria-label="l.label"
            >
              <svg v-if="l.icon === 'github'" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              <svg v-else-if="l.icon === 'mail'" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m3.5 8 7.6 5.1a1.6 1.6 0 0 0 1.8 0L20.5 8" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.4 4.5" />
                <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.6 19.5" />
              </svg>
            </a>
          </div>
        </section>

        <!-- ---------------- 入口大卡 ---------------- -->
        <div class="entries">
          <a
            v-for="(entry, i) in entries"
            :key="entry.link"
            class="card card--entry"
            :class="{ 'has-cover': !!entry.cover }"
            :style="entryStyle(i)"
            :href="withBase(entry.link)"
          >
            <span
              v-if="entry.cover"
              class="entry__cover"
              :style="{ backgroundImage: `url('${withBase(entry.cover)}')` }"
              aria-hidden="true"
            />
            <span class="entry__scrim" aria-hidden="true" />

            <span class="entry__body">
              <span v-if="entry.tag" class="entry__tag">{{ entry.tag }}</span>
              <span class="entry__title">{{ entry.title }}</span>
              <span class="entry__desc">{{ entry.desc }}</span>
            </span>

            <span class="entry__arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </a>
        </div>

        <!-- ---------------- 底部状态栏(没有时钟) ---------------- -->
        <div class="card card--status">
          <span class="status__note">{{ statusBar.note }}</span>
          <span class="status__badges">
            <span v-for="b in statusBar.badges" :key="b" class="badge">{{ b }}</span>
          </span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  padding-bottom: 48px;
}

/* ---------------- 顶栏 ---------------- */
.hdr {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border-bottom: 1px solid rgba(201, 139, 146, 0.25);
  box-shadow: 0 1px 2px rgba(90, 60, 66, 0.05);
}

.hdr__inner {
  width: 90%;
  max-width: 1120px;
  margin: 0 auto;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.hdr__brand {
  font-family: var(--site-font-serif);
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--ink-1);
  text-decoration: none;
  transition: color 0.3s;
}

.hdr__brand:hover {
  color: var(--p-rose-ink);
}

.hdr__nav {
  display: flex;
  gap: 26px;
}

.hdr__nav a {
  position: relative;
  font-family: var(--site-font-serif);
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
  text-decoration: none;
  transition: color 0.3s;
}

.hdr__nav a:hover,
.hdr__nav a.is-active {
  color: var(--p-rose-ink);
}

.hdr__nav a.is-active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--p-rose);
  transform: translateX(-50%);
}

/* ---------------- 布局 ---------------- */
.main {
  width: 90%;
  max-width: 1120px;
  margin: 0 auto;
  padding-top: 104px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 24px;
}

/* ---------------- 玻璃卡片 ---------------- */
.card {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 10px 30px -12px rgba(90, 60, 66, 0.22);
}

/* ---------------- 个人卡片 ---------------- */
.card--profile {
  grid-column: span 7;
  padding: 32px;
  display: flex;
  flex-direction: column;
  transition: transform 0.5s cubic-bezier(0.33, 1, 0.68, 1);
}

.card--profile:hover {
  transform: scale(1.008);
}

.profile {
  display: flex;
  align-items: center;
  gap: 22px;
  min-width: 0;
}

.profile__avatar {
  flex: 0 0 auto;
  width: 92px;
  height: 92px;
  border-radius: 20px;
  padding: 3px;
  background: linear-gradient(135deg, #c98b92, #a2dccf);
  box-shadow: 0 8px 20px -8px rgba(201, 139, 146, 0.65);
}

.profile__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 17px;
  background: #fff;
  display: block;
}

.profile__initial {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 17px;
  background: #fff;
  font-family: var(--site-font-serif);
  font-size: 38px;
  font-weight: 900;
  color: var(--p-rose-ink);
}

.profile__text {
  min-width: 0;
}

.profile__name {
  margin: 0 0 8px;
  font-family: var(--site-font-serif);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.25;
  color: var(--ink-1);
}

.profile__bio {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--ink-2);
}

.stats {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 28px;
}

.stats__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stats__value {
  font-family: var(--site-font-serif);
  font-size: 24px;
  font-weight: 900;
  color: var(--p-rose-ink);
  line-height: 1.1;
}

.stats__label {
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

.stats__sep {
  width: 1px;
  height: 30px;
  background: rgba(201, 139, 146, 0.35);
}

.links {
  display: flex;
  gap: 10px;
  margin-top: 28px;
}

.links__btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(201, 139, 146, 0.25);
  color: var(--ink-2);
  box-shadow: 0 1px 2px rgba(90, 60, 66, 0.06);
  transition: background-color 0.3s, color 0.3s, transform 0.3s, border-color 0.3s;
}

.links__btn svg {
  width: 19px;
  height: 19px;
}

.links__btn:hover {
  background: var(--p-rose);
  border-color: var(--p-rose);
  color: #fff;
  transform: translateY(-2px);
}

/* ---------------- 入口卡 ---------------- */
.entries {
  grid-column: span 5;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card--entry {
  position: relative;
  flex: 1 1 0;
  min-height: 150px;
  display: flex;
  align-items: flex-end;
  padding: 24px;
  overflow: hidden;
  text-decoration: none;
  transition: transform 0.5s cubic-bezier(0.33, 1, 0.68, 1), box-shadow 0.5s;
}

/* 没封面图时的四色渐变兜底 */
.card--entry::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--entry-from, #c98b92), var(--entry-to, #a2dccf));
}

.card--entry.has-cover::before {
  opacity: 0;
}

.entry__cover {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: transform 1s cubic-bezier(0.33, 1, 0.68, 1);
}

/* 深色蒙版,保证白字看得清 */
.entry__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(58, 38, 43, 0.8), rgba(58, 38, 43, 0.12));
  opacity: 0;
}

.card--entry.has-cover .entry__scrim {
  opacity: 1;
}

.card--entry:hover {
  transform: scale(1.02) translateY(-3px);
  box-shadow: 0 18px 40px -14px rgba(154, 90, 100, 0.5);
}

.card--entry:hover .entry__cover {
  transform: scale(1.06);
}

.entry__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.entry__tag {
  align-self: flex-start;
  margin-bottom: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-1);
}

.entry__title {
  font-family: var(--site-font-serif);
  font-size: 26px;
  font-weight: 700;
  color: var(--ink-1);
  line-height: 1.2;
}

.entry__desc {
  font-size: 13px;
  color: var(--ink-2);
}

.entry__arrow {
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--ink-1);
  transition: transform 0.4s, background-color 0.4s;
}

/* 用了封面照片时,才切成白字 + 深色蒙版 */
.card--entry.has-cover .entry__tag {
  background: rgba(255, 255, 255, 0.28);
  color: #fff;
}

.card--entry.has-cover .entry__title {
  color: #fff;
}

.card--entry.has-cover .entry__desc {
  color: rgba(255, 255, 255, 0.9);
}

.card--entry.has-cover .entry__arrow {
  background: rgba(255, 255, 255, 0.24);
  color: #fff;
}

.entry__arrow svg {
  width: 18px;
  height: 18px;
}

.card--entry:hover .entry__arrow {
  background: rgba(255, 255, 255, 0.42);
  transform: translateX(4px);
}

/* ---------------- 底部状态栏 ---------------- */
.card--status {
  grid-column: span 12;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 16px 24px;
}

.status__note {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
}

.status__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badge {
  padding: 5px 12px;
  border-radius: 10px;
  background: rgba(214, 240, 239, 0.75);
  border: 1px solid rgba(162, 220, 207, 0.6);
  box-shadow: 0 1px 2px rgba(90, 60, 66, 0.05);
  font-size: 11px;
  font-weight: 700;
  color: #2f6f66;
}

/* ---------------- 响应式 ---------------- */
@media (max-width: 960px) {
  .card--profile,
  .entries {
    grid-column: span 12;
  }
}

@media (max-width: 640px) {
  .hdr__inner {
    height: 56px;
  }

  .hdr__brand {
    font-size: 17px;
  }

  .hdr__nav {
    gap: 14px;
  }

  .hdr__nav a {
    font-size: 13px;
  }

  .main {
    padding-top: 84px;
  }

  .grid {
    gap: 16px;
  }

  .entries {
    gap: 16px;
  }

  .card--profile {
    padding: 22px;
  }

  .profile {
    gap: 16px;
  }

  .profile__avatar {
    width: 68px;
    height: 68px;
    border-radius: 16px;
  }

  .profile__initial {
    border-radius: 13px;
    font-size: 28px;
  }

  .stats {
    gap: 14px;
    margin-top: 20px;
  }

  .links {
    margin-top: 20px;
  }

  .card--entry {
    min-height: 132px;
    padding: 18px;
  }

  .card--status {
    padding: 14px 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card--entry,
  .entry__cover,
  .entry__arrow,
  .links__btn {
    transition: none;
  }

  .card--profile:hover,
  .card--entry:hover,
  .card--entry:hover .entry__cover,
  .links__btn:hover {
    transform: none;
  }
}
</style>
