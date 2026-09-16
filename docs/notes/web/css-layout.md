# CSS 布局笔记

Flex 和 Grid 的常用写法,当速查表用。

## Flex:一维布局

管一行或者一列的时候用它。

```css
.container {
  display: flex;
  gap: 12px;              /* 间距,比用 margin 干净 */
  justify-content: space-between;  /* 主轴对齐 */
  align-items: center;             /* 交叉轴对齐 */
}
```

### 几个高频组合

**水平垂直居中**

```css
.center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
```

**左边固定右边撑满**

```css
.layout { display: flex; }
.sidebar { flex: 0 0 240px; }
.main    { flex: 1; min-width: 0; }   /* min-width:0 防止内容把布局撑破 */
```

**一行放不下就换行**

```css
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
```

## Grid:二维布局

行列都要管的时候用它。

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
```

### 自动适应宽度(卡片墙常用)

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

这行的意思是:每列最少 260px,能塞几列塞几列,剩下的空间平分。
不用写媒体查询就能自适应。

### 指定某块跨列

```css
.wide { grid-column: 1 / -1; }   /* 从第一列横跨到最后一列 */
```

## Flex 还是 Grid?

| 场景 | 用哪个 |
| --- | --- |
| 导航栏、按钮组、单行排列 | Flex |
| 垂直居中 | Flex |
| 卡片网格、整页布局 | Grid |
| 行列都要对齐 | Grid |

简单记:**一行内容用 Flex,一整个区域用 Grid。**

## 常见坑

**子元素被内容撑爆**

Flex 子项默认 `min-width: auto`,里面的长文本或宽表格会把布局撑开。
加 `min-width: 0` 解决。

**gap 和 margin 混用导致间距翻倍**

定了 `gap` 就不要再给子元素加同方向的 `margin` 了。

**100vh 在手机上会超出一截**

移动端浏览器地址栏会占高度,可以用 `100dvh`:

```css
.hero { min-height: 100dvh; }
```
