"""
check.py — 檢查 data/ 裡的資料有沒有照 AGENTS.md 的規則寫。

用法（在專案根目錄）：
    python tools/check.py

只用 Python 內建模組，不需要安裝任何套件。
有錯誤時會列出「哪個檔案、哪一筆、哪個欄位、錯在哪」，並以結束碼 1 結束；
全部通過才會印出 OK。每次改完 data/ 都要跑一次。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DOC_ID = re.compile(r"^doc_\d{2}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# 中文字旁邊出現半形標點（應該用全形）
HALF_PUNCT = re.compile(r"[一-鿿][,;:!?]|[,;:!?][一-鿿]")
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐⭕]")

ITEM_KEYS = {"id", "name", "aliases", "category", "parts", "mistake", "brother", "local_note", "updated"}
PART_KEYS = {"part", "bin", "how", "docs"}
SCENE_KEYS = {"id", "level", "name", "seconds", "desc", "items"}
SOURCE_KEYS = {"id", "title", "org", "summary", "links", "collected"}

LIMITS = {"how": 40, "brother": 40, "mistake": 40, "name": 12}

errors, notes = [], []


def err(where, msg):
    errors.append(f"[錯誤] {where}：{msg}")


def note(msg):
    notes.append(f"[提醒] {msg}")


def load(name):
    path = DATA / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        err(name, "找不到這個檔案")
    except json.JSONDecodeError as e:
        err(name, f"JSON 格式錯誤（第 {e.lineno} 行第 {e.colno} 欄）：{e.msg}")
    return None


def check_text(where, field, value, required=True):
    if not isinstance(value, str):
        err(where, f"{field} 必須是文字")
        return
    if required and not value.strip():
        err(where, f"{field} 不可以是空的")
    if field in LIMITS and len(value) > LIMITS[field]:
        err(where, f"{field} 太長（{len(value)} 字，上限 {LIMITS[field]} 字）")
    if HALF_PUNCT.search(value):
        err(where, f"{field} 有半形標點，中文請用全形（，。：！？）")
    if EMOJI.search(value):
        err(where, f"{field} 不可以有 emoji")


def check_keys(where, obj, allowed):
    missing = allowed - obj.keys()
    extra = obj.keys() - allowed
    if missing:
        err(where, "缺少欄位 " + "、".join(sorted(missing)))
    if extra:
        err(where, "多了規則裡沒有的欄位 " + "、".join(sorted(extra)) + "（要新增欄位請先改 AGENTS.md）")


def main():
    meta = load("meta.json")
    sources = load("sources.json")
    items = load("items.json")
    scenes = load("scenes.json")
    if None in (meta, sources, items, scenes):
        return finish()

    bins = {b["id"] for b in meta["bins"]}
    cats = {c["id"] for c in meta["categories"]}

    # ---- sources.json ----
    doc_ids = set()
    for i, s in enumerate(sources):
        where = f"sources.json 第 {i + 1} 筆（{s.get('id', '?')}）"
        check_keys(where, s, SOURCE_KEYS)
        sid = s.get("id", "")
        if not DOC_ID.match(sid):
            err(where, "id 要是 doc_ 加兩位數字，例如 doc_19")
        if sid in doc_ids:
            err(where, f"id {sid} 重複了")
        doc_ids.add(sid)
        for f in ("title", "org", "summary"):
            check_text(where, f, s.get(f, ""))
        links = s.get("links", [])
        if not links:
            err(where, "至少要有一個來源連結")
        for link in links:
            if not str(link.get("url", "")).startswith("https://"):
                err(where, f"連結 {link.get('url')} 不是 https 網址")
        if not DATE.match(str(s.get("collected", ""))):
            err(where, "collected 要寫成 YYYY-MM-DD")

    # ---- items.json ----
    item_ids, names, cited = set(), {}, set()
    for i, it in enumerate(items):
        where = f"items.json 第 {i + 1} 筆（{it.get('id', '?')}）"
        check_keys(where, it, ITEM_KEYS)
        iid = it.get("id", "")
        if not SLUG.match(iid):
            err(where, "id 要用英文小寫和連字號，例如 bubble-tea")
        if iid in item_ids:
            err(where, f"id {iid} 重複了")
        item_ids.add(iid)
        check_text(where, "name", it.get("name", ""))
        if it.get("name") in names:
            err(where, f"名稱「{it['name']}」和 {names[it['name']]} 重複")
        names[it.get("name")] = iid
        if not isinstance(it.get("aliases"), list):
            err(where, "aliases 必須是清單（沒有就寫 []）")
        if it.get("category") not in cats:
            err(where, f"category「{it.get('category')}」不在 meta.json 的分類清單裡")
        for f in ("mistake", "brother"):
            check_text(where, f, it.get(f, ""))
        check_text(where, "local_note", it.get("local_note", ""), required=False)
        if not DATE.match(str(it.get("updated", ""))):
            err(where, "updated 要寫成 YYYY-MM-DD")
        parts = it.get("parts", [])
        if not parts:
            err(where, "parts 至少要有一個部件")
        for j, p in enumerate(parts):
            pw = f"{where} 的第 {j + 1} 個部件（{p.get('part', '?')}）"
            check_keys(pw, p, PART_KEYS)
            check_text(pw, "part", p.get("part", ""))
            check_text(pw, "how", p.get("how", ""))
            if p.get("bin") not in bins:
                err(pw, f"bin「{p.get('bin')}」不是規定的代碼（{'、'.join(sorted(bins))}）")
            docs = p.get("docs", [])
            if not docs:
                err(pw, "沒有依據文件；每個部件都要有 docs")
            for d in docs:
                if d not in doc_ids:
                    err(pw, f"依據 {d} 不在 sources.json 裡")
                cited.add(d)

    # 別名不能剛好是另一樣物品的名稱，不然搜尋會混淆
    for it in items:
        for a in it.get("aliases", []):
            if a in names and names[a] != it.get("id"):
                err(f"items.json（{it.get('id')}）", f"別名「{a}」剛好是另一樣物品 {names[a]} 的名稱")

    # ---- scenes.json ----
    scene_ids, levels, in_scene = set(), set(), set()
    for i, sc in enumerate(scenes):
        where = f"scenes.json 第 {i + 1} 筆（{sc.get('id', '?')}）"
        check_keys(where, sc, SCENE_KEYS)
        if not SLUG.match(sc.get("id", "")):
            err(where, "id 要用英文小寫和連字號")
        if sc.get("id") in scene_ids:
            err(where, "id 重複了")
        scene_ids.add(sc.get("id"))
        if sc.get("level") in levels:
            err(where, f"level {sc.get('level')} 重複了")
        levels.add(sc.get("level"))
        if not isinstance(sc.get("seconds"), int) or sc["seconds"] <= 0:
            err(where, "seconds 要是正整數")
        check_text(where, "name", sc.get("name", ""))
        check_text(where, "desc", sc.get("desc", ""))
        seen = set()
        for x in sc.get("items", []):
            if x not in item_ids:
                err(where, f"物品 {x} 不在 items.json 裡")
            if x in seen:
                err(where, f"物品 {x} 重複出現")
            seen.add(x)
            in_scene.add(x)

    # ---- 只提醒、不算錯 ----
    lonely = sorted(item_ids - in_scene)
    if lonely:
        note("還沒放進任何情境的物品：" + "、".join(lonely))
    unused = sorted(doc_ids - cited)
    if unused:
        note("還沒被任何物品引用的依據：" + "、".join(unused))

    return finish(len(items), len(sources), len(scenes))


def finish(n_items=0, n_sources=0, n_scenes=0):
    for line in errors + notes:
        print(line)
    if errors:
        print(f"\n沒有通過：{len(errors)} 個錯誤。請照上面的訊息修正後再跑一次。")
        return 1
    print(f"OK：{n_items} 樣物品、{n_sources} 份依據文件、{n_scenes} 個情境，全部符合規則。")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
