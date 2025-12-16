# VocabSprint（Deno）

一个本地运行的单词管理 Web 应用（Deno + 原生 HTML/JS/CSS），用于浏览词库、键盘快速标记掌握情况，并维护“生词本”。

## 预览

- Table 视图预览图：![](docs/preview-table.png)
- 逐个视图预览图：![](docs/preview-card.png)

## 功能

### 数据展示

- 读取 `netem_full_list.json` 并展示单词、释义、词频、其他拼写
- 支持两种视图：Table 列表视图 / 逐个（卡片）视图

### Table 视图

- 列表展示单词，checkbox 标记“已掌握/未掌握”，行背景色区分
- 键盘操作：
	- `W/S` 或 `A/D`：切换上一行/下一行（焦点始终在“掌握”checkbox）
	- `J/K`：将当前行标记为 已掌握/未掌握
	- `L`：加入/移出生词本
	- “打字机模式”：按 `A/D` 切换时自动将下一行滚动到视口居中
- 筛选：全部 / 已掌握 / 未掌握 / 生词

### 逐个（卡片）视图

- 类 Apple 的居中滚动选择器布局：上一个 / 当前 / 下一个
- 显示 metadata：词频、其他拼写；并用角标 + 左侧色条表达掌握状态
- 键盘操作：
	- `A/W`：上一个
	- `D/S`：下一个
	- `J`：标记熟知（已掌握），并自动切换到下一个
	- `K`：标记不会（未掌握），并自动切换到下一个
	- `L`：加入/移出生词本
- 统计信息：开始时间 / 本次标记数量 / 已掌握比例
- 一键跳转：跳到“第一个未掌握”
- 自动发音（可开关，localStorage 记忆）：使用有道发音接口
	- `https://dict.youdao.com/dictvoice?audio=<word>&type=2`
	- 注意：浏览器通常需要一次用户交互（键盘/点击）后才允许自动播放
- 筛选：全部 / 已掌握 / 未掌握 / 生词（筛选后 prev/next 会在筛选集合内切换）

## 运行（开发模式）

在本目录执行：

- `deno task dev`

然后打开：

- http://localhost:8000/table
- http://localhost:8000/card

## CLI（参数 & 环境变量）

入口文件是 `cli.ts`（`server.ts` 仅提供 `startServer()`）。

优先级：

- 参数 > 环境变量 > 默认值

常用参数：

- `--port <number>` / `-p <number>`：端口（环境变量 `PORT`，默认 `8000`）
- `--hostname <string>`：绑定地址（环境变量 `HOSTNAME`，默认 `0.0.0.0`）
- `--words-file <path>`：词库 JSON 路径（环境变量 `WORDS_FILE`，默认 `./netem_full_list.json`）
- `--kv-path <path>`：Deno KV 路径（环境变量 `KV_PATH`，默认 `./data/kv`）
- `--open` / `--no-open`：是否尝试自动打开浏览器（环境变量 `NO_OPEN=1` 可禁用；开发模式默认不打开，`AUTO_OPEN=1` 可开启）
- `--no-chdir`：禁用“编译后二进制启动时自动 chdir 到可执行文件目录”的行为（环境变量 `NO_CHDIR=1` 同理）

示例：

- `deno task dev -- --port 8001`
- `deno task start`（默认会尝试自动打开浏览器，可用 `--no-open` 或 `NO_OPEN=1` 关闭）
- `WORDS_FILE=./netem_full_list.json KV_PATH=./data/kv deno task start`
- `deno run --unstable-kv --allow-net --allow-read --allow-write --allow-env cli.ts --port 8002 --words-file ./netem_full_list.json --kv-path ./data/kv`

查看完整帮助：

- `deno task start -- --help`

Open 默认行为：

- `deno task dev`：默认不打开；可用 `AUTO_OPEN=1` 或传 `--open` 开启
- `deno task start`：默认打开；可用 `NO_OPEN=1` 或传 `--no-open` 关闭

## 数据与状态存储

- 词库数据：`./netem_full_list.json`
- 状态存储：Deno KV（默认路径 `./data/kv`）
	- 已掌握：`mastered`
	- 生词本：`vocab`

可选环境变量：

- `WORDS_FILE`：指定 JSON 路径
- `KV_PATH`：指定 KV 路径

## 发布二进制（GitHub Releases）

本仓库带有 GitHub Actions：当你推送一个 tag（如 `v0.1.0`）时，会自动构建并发布对应平台的可执行文件到 GitHub Release。

示例：

- `git tag v0.1.0`
- `git push origin v0.1.0`

Release 产物是 zip 包，包含：可执行文件 + `public/` + `netem_full_list.json`。解压后直接运行即可。
