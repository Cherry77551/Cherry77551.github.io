# 怎么用这个站记笔记

这个站的每一页都是一个 `.md` 文件,写进去就自动变成网页。

## 新建一篇笔记

1. 在 `docs/notes/` 下面新建文件,比如 `docs/notes/unity/coroutine.md`
2. 第一行写标题:

   ```md
   # 协程
   ```

3. 正常往下写内容
4. 打开 `docs/.vitepress/config.mts`,在 `sidebar` 的 `'/notes/'` 里加一行:

   ```ts
   { text: '协程', link: '/notes/unity/coroutine' }
   ```

这样它就出现在左边目录里了。

::: tip 文件路径就是网址
`docs/notes/unity/coroutine.md` 对应的网址是 `/notes/unity/coroutine`。
开头目录 `docs/` 不算,末尾的 `.md` 不算。
:::

## 常用 Markdown 写法

### 标题

```md
# 一级标题(每篇只用一次)
## 二级标题
### 三级标题
```

二级、三级标题会自动出现在右边的「本页目录」里。

### 强调和链接

```md
**加粗** 和 *斜体*
[链接文字](https://vitepress.dev)
[站内跳转](/notes/)
```

### 代码

行内代码用反引号 `` `npm run dev` ``。

代码块要标语言,这样才有语法高亮:

````md
```bash
npm run dev
```

```js
const answer = 42
```
````

### 列表和表格

```md
- 第一项
- 第二项
  - 可以嵌套

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |
```

### 提示框

VitePress 自带几种提示块,颜色跟着主题走(本站是淡绿色):

```md
::: tip 提示
这是个提示
:::

::: warning 注意
这是个警告
:::

::: danger 危险
这是个危险提示
:::

::: details 点开看更多
折叠起来的内容
:::
```

::: tip 提示
提示块的绿色就是来自主题的 `--vp-c-brand-*` 变量。
:::

## 写完之后

```bash
npm run dev      # 本地预览,改文件会自动刷新
git add .
git commit -m "add: docker 笔记"
git push         # 推上去后 GitHub Actions 会自动发布
```
