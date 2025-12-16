# words_ana（Deno）

一个最小的“单词管理”Web 应用：

- Table 视图：列表展示 + checkbox 标记掌握/未掌握，并用背景色区分
- 逐个视图：中间显示当前单词，左右显示上一个/下一个；支持键盘快捷键

## 运行

在本目录执行：

- `deno task dev`

然后打开：

- http://localhost:8000/table
- http://localhost:8000/card

## 数据与状态存储

- 单词数据读取：`./netem_full_list.json`
- 掌握状态存储：Deno KV（默认路径 `./data/kv`）

可选环境变量：

- `WORDS_FILE`：指定 JSON 路径
- `KV_PATH`：指定 KV 路径
