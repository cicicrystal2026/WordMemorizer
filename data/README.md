# 词库数据

## `gaokao-3500.json`

高考必备 3500 词的结构化词库，作为背诵内容的基础底库。由 `scripts/parse-gaokao-3500.py`
从 `source/gaokao-3500.pdf` 解析生成，可随时重跑：

```bash
pip install pypdf
python3 scripts/parse-gaokao-3500.py data/source/gaokao-3500.pdf data/gaokao-3500.json
```

### 规模

| 指标 | 数量 |
| --- | --- |
| 词条总数 | 3431 |
| 去重词形 | 3407 |
| 同形异义词条（`bear 1` / `bear 2` 等） | 46 |
| 带不规则变化形式 | 202 |
| 多义项词条 | 358 |

### 字段

```jsonc
{
  "word": "advance",          // 词形，用于展示、拼写校验和发音
  "letter": "A",              // 所属字母分组，来自 PDF 的 A–Z 分节
  "pos": ["v", "n"],          // 归一化词性，取值见下
  "meaning": "推进，促进；前进;n..前进，进展；...",  // 原文释义，保留未拆分状态备查
  "senses": [                 // 按词性拆开的义项，供出题使用
    { "pos": ["v"], "text": "推进，促进；前进" },
    { "pos": ["n"], "text": "前进，进展；增进，进步；向上，晋升 (inrank)" }
  ],
  "variants": [],             // 同一词条的其他写法，如 a.m. 的 am / A.M. / AM
  "inflections": null,        // 不规则变化，如 write 的 "wrote,written"
  "homograph": null,          // 同形异义编号，如 bear 1 / bear 2
  "alias": null,              // 源文件中的等价写法，如 ad = advertisement
  "id": 78                    // 稳定自增主键
}
```

词性归一化为：`n` `v` `vt` `vi` `adj` `adv` `prep` `pron` `conj` `int` `num` `art`
`aux` `abbr`。源文件用 `a.` 表形容词、`ad.` 表副词，已统一为 `adj` / `adv`。

出题时**用 `senses`，不要用 `meaning`** —— `meaning` 保留了源文件把多个义项挤在一行、
中间夹词性标记的原始形态（`推进，促进；前进;n..前进，进展`），直接展示会很难读。

### 这份数据还缺什么

底库只提供**词形、词性、中文释义**三样。四关学习流还需要的三个字段，源 PDF 里没有：

- **音标** —— 全部缺失
- **常用搭配 / 词组** —— 全部缺失
- **例句及翻译** —— 全部缺失

这三项需要另行补全（AI 生成或接词典数据），补全后应写入独立文件，不要回写本文件，
以便随时用上面的命令从 PDF 重新生成而不丢失人工修订。

### 已知的源文件问题

解析器已处理，但记录在此以备核对：

- 词条跨行折断，续行以中文或裸词性标记（`n.广播节目`）开头
- `a.m.` 的写法 `a.m.&am,A.M.&AM` 与续行规则冲突，需特判，否则会被并进上一条 `am`
- 7 个词条（`a` `am` `anchor` `are` `can't` `glass` `is` `riddle`）源文件漏写释义，
  已在 `scripts/parse-gaokao-3500.py` 的 `MISSING_MEANINGS` 中补齐
- `plchildren`、`Amaluminum` 一类变形丢了分隔符，已还原为 `pl. children`、`Am. aluminum`

## `source/gaokao-3500.pdf`

原始材料，WPS 文字导出，43 页，含文本层（非扫描件）。仅作解析输入留存。
