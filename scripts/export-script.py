#!/usr/bin/env python3
"""Export a murder mystery script JSON to structured Markdown files."""
import json, os, sys

def to_str(v):
    if isinstance(v, str): return v
    if isinstance(v, list): return ', '.join(str(x) for x in v)
    if isinstance(v, dict): return json.dumps(v, ensure_ascii=False, indent=2)
    return str(v)

def flatten_timeline(tl):
    """Handle timeline as list of strings, list of dicts, or dict of lists."""
    items = []
    if isinstance(tl, list):
        for t in tl:
            if isinstance(t, dict):
                items.append(f"**{t.get('time','')}** {t.get('event','')}")
            else:
                items.append(str(t))
    elif isinstance(tl, dict):
        for section, events in tl.items():
            items.append(f"### {section}")
            if isinstance(events, list):
                for e in events:
                    if isinstance(e, dict):
                        items.append(f"- **{e.get('time','')}** {e.get('event','')}")
                    else:
                        items.append(f"- {e}")
            else:
                items.append(str(events))
    return items

def export_script(json_path, output_dir):
    with open(json_path, 'r') as f:
        d = json.load(f)

    os.makedirs(output_dir, exist_ok=True)
    title = d.get('title', '未命名剧本')
    config = d.get('config', {})
    dm = d.get('dmHandbook', {})
    players = d.get('playerHandbooks', [])
    materials = d.get('materials', [])
    branch = d.get('branchStructure', {})

    player_files = []
    for i, ph in enumerate(players):
        name = ph.get('characterName', f'角色{i+1}')
        player_files.append((name, f'player-{i+1}-{name}.md'))

    # === README.md ===
    lines = [f'# {title}', '',
        f'> 生成时间: {d.get("createdAt","N/A")}  ',
        f'> 版本: {d.get("version","N/A")} | 状态: {d.get("status","N/A")}', '',
        '## 配置参数', '',
        '| 参数 | 值 |', '|------|-----|',
        f'| 玩家人数 | {config.get("playerCount","?")} |',
        f'| 游戏时长 | {config.get("durationHours","?")}小时 |',
        f'| 游戏类型 | {config.get("gameType","?")} |',
        f'| 推理/还原 | {config.get("deductionRatio","?")}% / {config.get("restorationRatio","?")}% |',
        f'| 时代背景 | {config.get("era","?")} |',
        f'| 地点设定 | {config.get("location","?")} |',
        f'| 主题风格 | {config.get("theme","?")} |', '',
        '## 文件目录', '',
        '- [📖 DM手册](./dm-handbook.md)']
    for name, fname in player_files:
        lines.append(f'- [🎭 {name}](./{fname})')
    lines += ['- [🃏 游戏物料](./materials.md)', '- [🔀 分支结构](./branch-structure.md)', '']
    write(output_dir, 'README.md', lines)

    # === DM Handbook ===
    lines = [f'# 📖 DM手册 - {title}', '', '[← 返回目录](./README.md)', '']

    # Overview
    overview = dm.get('overview', '')
    lines += ['## 案件概述', '']
    if isinstance(overview, dict):
        for k, v in overview.items():
            if isinstance(v, dict):
                lines.append(f'### {k}')
                for kk, vv in v.items():
                    lines.append(f'- **{kk}**: {vv}')
                lines.append('')
            elif isinstance(v, list):
                lines.append(f'### {k}')
                for item in v:
                    lines.append(f'- {to_str(item)}')
                lines.append('')
            else:
                lines += [f'**{k}**: {v}', '']
    else:
        lines += [str(overview), '']

    # Characters
    chars = dm.get('characters', [])
    if chars:
        lines += ['## 角色列表', '']
        for c in chars:
            if isinstance(c, dict):
                lines.append(f'### {c.get("name","?")} ({c.get("role","?")})')
                for k, v in c.items():
                    if k not in ('name', 'role', 'id'):
                        lines.append(f'- **{k}**: {to_str(v)}')
                lines.append('')
            else:
                lines.append(f'- {c}')

    # Timeline
    tl = dm.get('timeline', [])
    if tl:
        lines += ['## 时间线', '']
        lines += flatten_timeline(tl)
        lines.append('')

    # Clue Distribution
    clues = dm.get('clueDistribution', [])
    if clues:
        lines += ['## 线索分发表', '']
        if isinstance(clues, list):
            for cd in clues:
                if isinstance(cd, dict):
                    r = cd.get('round', '?')
                    lines.append(f'### 第{r}轮')
                    for cl in cd.get('clues', []):
                        if isinstance(cl, dict):
                            lines.append(f'- **{cl.get("clueId","?")}** [{cl.get("type","")}]: {cl.get("content","")}')
                        else:
                            lines.append(f'- {cl}')
                    lines.append('')
        elif isinstance(clues, dict):
            lines.append(to_str(clues))
            lines.append('')

    # Round Guides
    guides = dm.get('roundGuides', [])
    if guides:
        lines += ['## 轮次引导', '']
        for g in guides:
            if isinstance(g, dict):
                lines.append(f'### 第{g.get("round", g.get("roundIndex","?"))}轮')
                lines.append(to_str(g.get('guide', g.get('focus', ''))))
                lines.append('')
            else:
                lines.append(str(g))

    # Truth
    truth = dm.get('truthReveal', '')
    if truth:
        lines += ['## 真相揭示', '', to_str(truth), '']

    # Endings
    endings = dm.get('endings', [])
    if endings:
        lines += ['## 结局', '']
        for e in endings:
            if isinstance(e, dict):
                lines.append(f'### {e.get("name","?")}')
                lines.append(f'> 条件: {e.get("condition","")}')
                lines.append('')
                lines.append(to_str(e.get('content', '')))
                lines.append('')

    # Judging Rules
    rules = dm.get('judgingRules', {})
    if rules:
        lines += ['## 判定规则', '']
        if isinstance(rules, dict):
            for k, v in rules.items():
                lines.append(f'**{k}**: {v}')
                lines.append('')

    # Player links
    lines += ['---', '', '## 玩家手册', '']
    for name, fname in player_files:
        lines.append(f'- [🎭 {name}](./{fname})')
    lines.append('')
    write(output_dir, 'dm-handbook.md', lines)

    # === Player Handbooks ===
    for i, ph in enumerate(players):
        name, fname = player_files[i]
        lines = [f'# 🎭 玩家手册 - {name}', '',
            f'[← 返回目录](./README.md) | [📖 DM手册](./dm-handbook.md)', '',
            '## 基本信息', '',
            f'- **角色ID**: {ph.get("characterId","")}',
            f'- **主要目标**: {ph.get("primaryGoal","")}', '']

        sg = ph.get('secondaryGoals', [])
        if sg:
            lines += ['## 次要目标', '']
            for g in sg:
                lines.append(f'- {g}')
            lines.append('')

        bg = ph.get('backgroundStory', '')
        if bg:
            lines += ['## 背景故事', '', to_str(bg), '']

        rels = ph.get('relationships', [])
        if rels:
            lines += ['## 人物关系', '']
            for r in rels:
                if isinstance(r, dict):
                    lines.append(f'- **{r.get("target",r.get("characterName","?"))}**: {r.get("relation",r.get("relationship",""))}')
                else:
                    lines.append(f'- {r}')
            lines.append('')

        secrets = ph.get('secrets', [])
        if secrets:
            lines += ['## 秘密', '']
            for s in secrets:
                lines.append(f'- 🔒 {s}')
            lines.append('')

        kc = ph.get('knownClues', [])
        if kc:
            lines += ['## 已知线索', '']
            for c in kc:
                lines.append(f'- 🔍 {to_str(c)}')
            lines.append('')

        ra = ph.get('roundActions', [])
        if ra:
            lines += ['## 每轮行动指引', '']
            for j, a in enumerate(ra):
                if isinstance(a, dict):
                    lines.append(f'### 第{a.get("round", j+1)}轮')
                    lines.append(to_str(a.get('action', a.get('guide', str(a)))))
                else:
                    lines.append(f'### 第{j+1}轮')
                    lines.append(str(a))
                lines.append('')

        lines += ['---', '', '### 其他玩家手册', '']
        for j, (oname, ofname) in enumerate(player_files):
            if j != i:
                lines.append(f'- [🎭 {oname}](./{ofname})')
        lines.append('')
        write(output_dir, fname, lines)

    # === Materials ===
    lines = [f'# 🃏 游戏物料 - {title}', '',
        '[← 返回目录](./README.md) | [📖 DM手册](./dm-handbook.md)', '']
    if isinstance(materials, list) and materials:
        by_type = {}
        for m in materials:
            if isinstance(m, dict):
                t = m.get('type', 'other')
                by_type.setdefault(t, []).append(m)
            else:
                by_type.setdefault('other', []).append(m)
        type_names = {'clue_card':'线索卡','prop_card':'道具卡','vote_card':'投票卡','scene_card':'场景卡'}
        for t, items in by_type.items():
            lines.append(f'## {type_names.get(t, t)}')
            lines.append('')
            for m in items:
                if isinstance(m, dict):
                    lines.append(f'### {m.get("id","?")}')
                    lines.append(to_str(m.get('content', '')))
                    if m.get('associatedCharacterId'):
                        lines.append(f'> 关联角色: {m["associatedCharacterId"]}')
                    lines.append('')
                else:
                    lines.append(f'- {m}')
    elif isinstance(materials, dict):
        lines.append(to_str(materials))
    else:
        lines.append('*暂无物料数据*')
    lines.append('')
    write(output_dir, 'materials.md', lines)

    # === Branch Structure ===
    lines = [f'# 🔀 分支结构 - {title}', '',
        '[← 返回目录](./README.md) | [📖 DM手册](./dm-handbook.md)', '']
    nodes = branch.get('nodes', [])
    edges = branch.get('edges', [])
    endings_br = branch.get('endings', [])
    if nodes:
        lines += ['## 节点', '']
        for n in nodes:
            if isinstance(n, dict):
                lines.append(f'- **{n.get("id","?")}** [{n.get("type","")}]: {n.get("content",to_str(n))}')
            else:
                lines.append(f'- {n}')
        lines.append('')
    if edges:
        lines += ['## 连接', '']
        for e in edges:
            if isinstance(e, dict):
                lines.append(f'- {e.get("from","?")} → {e.get("to","?")} ({e.get("condition","")})')
            else:
                lines.append(f'- {e}')
        lines.append('')
    if endings_br:
        lines += ['## 结局节点', '']
        for e in endings_br:
            if isinstance(e, dict):
                lines.append(f'- **{e.get("id","?")}**: {e.get("name","")} - {to_str(e.get("content",""))}')
            else:
                lines.append(f'- {e}')
        lines.append('')
    write(output_dir, 'branch-structure.md', lines)

    print(f'✅ Exported to {output_dir}/')
    for fn in sorted(os.listdir(output_dir)):
        if fn.endswith('.md'):
            size = os.path.getsize(os.path.join(output_dir, fn))
            print(f'   {fn} ({size:,} bytes)')

def write(d, name, lines):
    with open(os.path.join(d, name), 'w') as f:
        f.write('\n'.join(lines))

if __name__ == '__main__':
    export_script('output/generated-script.json', 'scripts/霞飞路1935-晚宴枪声')
    print()
    export_script('output/staged-cyberpunk-script.json', 'scripts/赛博朋克2077-AI觉醒')
