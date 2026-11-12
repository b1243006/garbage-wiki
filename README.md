# 垃圾分類小百科

一樣東西常常要拆成好幾部分丟。這個網站一樣物品一頁，寫清楚每個部分丟哪裡、怎麼處理，以及根據哪份公開資料。

- 網站：https://b1243006.github.io/garbage-wiki/
- 專案規則（給 AI 看）：[AGENTS.md](AGENTS.md)
- 變更紀錄：[CHANGELOG.md](CHANGELOG.md)

TAICA「生成式 AI：文字與圖像生成的原理與實務」第九週作業。資料延續第七週的垃圾分類 RAG（18 篇公開資料摘要），
同一份 `data/items.json` 之後會給期末專案「清潔隊大哥的分類挑戰」使用。

## 本機預覽

```bash
python -m http.server 8000
# 打開 http://localhost:8000
```

直接雙擊 HTML 的話，瀏覽器會擋住讀取 JSON，所以要用上面的方式開。

## 改完資料後

```bash
python tools/check.py
```

顯示 OK 才算完成。
