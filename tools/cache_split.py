# Đếm token ghi cache 5m vs 1h trong transcript gần đây, tách luồng chính / subagent.
import json, os, sys, time, glob, collections
root = os.path.expanduser("~/.claude/projects")
cut = time.time() - 7*86400
agg = collections.defaultdict(lambda: [0, 0, 0])  # 5m, 1h, msgs
seen = set()
for p in glob.glob(root + "/**/*.jsonl", recursive=True):
    if os.path.getmtime(p) < cut: continue
    kind = "subagent" if os.sep + "subagents" + os.sep in p or "/subagents/" in p.replace("\\", "/") else "main"
    with open(p, encoding="utf-8", errors="ignore") as f:
        for line in f:
            if '"cache_creation"' not in line: continue
            try: d = json.loads(line)
            except Exception: continue
            m = d.get("message") or {}
            u = m.get("usage") or {}
            cc = u.get("cache_creation") or {}
            rid = d.get("requestId") or m.get("id")
            if rid in seen: continue
            seen.add(rid)
            model = m.get("model", "?")
            a = agg[(kind, model)]
            a[0] += cc.get("ephemeral_5m_input_tokens", 0); a[1] += cc.get("ephemeral_1h_input_tokens", 0); a[2] += 1
print("kind,model,req,w5m,w1h,share_1h")
for (k, mdl), (a, b, n) in sorted(agg.items()):
    print(f"{k},{mdl},{n},{a},{b},{(b/(a+b) if a+b else 0):.3f}")
