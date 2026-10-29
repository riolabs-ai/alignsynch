#!/usr/bin/env python3
"""mimo-probe.py — reproducible Xiaomi MiMo API probes (stdlib only, no pip).

Feeds docs/MIMO-GUIDE.md. Every probe prints one ``evidence:`` line per measured
fact; the guide may only claim what a doc URL or an ``evidence:`` line supports.

Usage:
    export XIAOMI_API_KEY=tp-xxxx        # or: XIAOMI_API_KEY_FILE=/path/to/key
    export XIAOMI_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1   # optional
    python3 scripts/mimo-probe.py                    # run everything (13 probes)
    python3 scripts/mimo-probe.py p01 p09            # run a subset
    python3 scripts/mimo-probe.py --list             # list probe ids

Probes (>=12 recorded call groups):
    p01  max_tokens floor, thinking ENABLED  (sweep 1..256, empty-content check)
    p02  max_tokens floor, thinking DISABLED (same sweep)
    p03  streaming vs non-stream (time-to-first-chunk, delta fields)
    p04  reasoning_content: response shape + must-echo-back rule (expect 400 without it)
    p05  tool_calls round-trip (request -> tool_calls -> tool result -> final answer)
    p06  parallel tool calls (does one assistant turn carry >1 tool_call?)
    p07  vision via image URL (official example image)
    p08  1M-context edge: oversized prompt (>1M tokens) error shape + normal prompt accounting
    p09  cached_tokens on a repeated prefix (two identical calls, compare usage)
    p10  concurrency: 10 parallel calls (status/latency distribution, any 429)
    p11  error shapes: bad model id, oversized max_tokens, /v1/models health check
    p12  ultraspeed model behaviour (mimo-v2.6-pro-ultraspeed)
    p13  token-plan accounting: response headers, usage accounting fields

Exit code 0 even when individual probes record errors — the log IS the result.
"""
from __future__ import annotations

import base64
import concurrent.futures as cf
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request

DEFAULT_BASE = "https://token-plan-sgp.xiaomimimo.com/v1"
MODEL = os.environ.get("MIMO_PROBE_MODEL", "mimo-v2.6-pro")
ULTRASPEED = "mimo-v2.6-pro-ultraspeed"
EXAMPLE_IMAGE = "https://example-files.cnbj1.mi-fds.com/example-files/image/image_example.png"

OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mimo-probe-results.jsonl")
_print_lock = threading.Lock()
_results_lock = threading.Lock()


# ── plumbing ────────────────────────────────────────────────────────────────

def api_key() -> str:
    key = os.environ.get("XIAOMI_API_KEY", "").strip()
    if not key:
        path = os.environ.get("XIAOMI_API_KEY_FILE", "")
        if path and os.path.isfile(path):
            key = open(path, encoding="utf-8").read().strip()
    return key


def base_url() -> str:
    return os.environ.get("XIAOMI_BASE_URL", DEFAULT_BASE).rstrip("/")


def say(line: str) -> None:
    with _print_lock:
        print(line, flush=True)


def record(probe: str, payload: dict) -> None:
    with _results_lock:
        with open(OUT_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"probe": probe, **payload}, ensure_ascii=False) + "\n")


def post(path: str, body: dict, *, raw_body: bytes | None = None,
         timeout: float = 120.0) -> tuple[int, dict[str, str], str, float]:
    """POST JSON; returns (status, headers_dict, text). Never raises on HTTP errors."""
    data = raw_body if raw_body is not None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        base_url() + path, data=data, method="POST",
        headers={"api-key": api_key(), "Content-Type": "application/json"},
    )
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", "replace")
            return resp.status, dict(resp.headers), text, time.monotonic() - t0
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", "replace")
        return exc.code, dict(exc.headers), text, time.monotonic() - t0
    except Exception as exc:  # transport-level failure is evidence too
        return -1, {}, f"TRANSPORT_ERROR {type(exc).__name__}: {exc}", time.monotonic() - t0


def get(path: str, timeout: float = 30.0):
    req = urllib.request.Request(base_url() + path, headers={"api-key": api_key()})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, dict(resp.headers), resp.read().decode("utf-8", "replace"), time.monotonic() - t0
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read().decode("utf-8", "replace"), time.monotonic() - t0
    except Exception as exc:
        return -1, {}, f"TRANSPORT_ERROR {type(exc).__name__}: {exc}", time.monotonic() - t0


def chat(body: dict, *, timeout: float = 120.0):
    return post("/chat/completions", body, timeout=timeout)


def summarize(probe: str, label: str, status: int, headers: dict, text: str, dt: float) -> dict:
    """One canonical evidence line + a compact record."""
    try:
        j = json.loads(text)
    except Exception:
        j = None
    content = ""
    reasoning = None
    finish = None
    tool_calls = 0
    usage = None
    if isinstance(j, dict):
        ch = (j.get("choices") or [{}])[0]
        msg = ch.get("message") or ch.get("delta") or {}
        content = msg.get("content") or ""
        reasoning = msg.get("reasoning_content")
        finish = ch.get("finish_reason")
        tool_calls = len(msg.get("tool_calls") or [])
        usage = j.get("usage")
    err = None
    if isinstance(j, dict) and j.get("error"):
        err = j["error"]
    elif status >= 400 or status == -1:
        err = text[:300]
    empty = (status == 200 and not (content or "").strip() and tool_calls == 0)
    line = (f"evidence: {probe} {label} status={status} latency={dt:.2f}s "
            f"content_len={len(content or '')} empty_content={empty} finish={finish} "
            f"tool_calls={tool_calls}")
    if usage is not None:
        line += f" usage={json.dumps(usage, ensure_ascii=False)}"
    if reasoning is not None:
        line += f" reasoning_len={len(reasoning or '')}"
    if err is not None:
        line += f" error={json.dumps(err, ensure_ascii=False)[:300]}"
    say(line)
    rec = {"label": label, "status": status, "latency_s": round(dt, 3),
           "content_len": len(content or ""), "empty_content": empty, "finish": finish,
           "tool_calls": tool_calls, "usage": usage, "error": err,
           "headers": {k: v for k, v in headers.items()
                       if not k.lower().startswith(("set-cookie",))},
           "content_head": (content or "")[:200],
           "reasoning_head": (reasoning or "")[:200] if reasoning is not None else None}
    record(probe, rec)
    return rec


def user_msg(text: str) -> list:
    return [{"role": "user", "content": text}]


# ── probes ──────────────────────────────────────────────────────────────────

def p01_max_tokens_floor_thinking_on():
    """max_tokens floor sweep, thinking left at its default (enabled)."""
    for n in (1, 2, 8, 16, 64, 256):
        status, headers, text, dt = chat({
            "model": MODEL, "messages": user_msg("Reply with exactly: OK"),
            "max_tokens": n,
        })
        summarize("p01", f"thinking-on max_tokens={n}", status, headers, text, dt)


def p02_max_tokens_floor_thinking_off():
    """Same sweep with thinking explicitly disabled."""
    for n in (1, 2, 8, 16, 64, 256):
        status, headers, text, dt = chat({
            "model": MODEL, "messages": user_msg("Reply with exactly: OK"),
            "max_tokens": n, "thinking": {"type": "disabled"},
        })
        summarize("p02", f"thinking-off max_tokens={n}", status, headers, text, dt)


def p03_streaming_vs_non_stream():
    """Streaming: time to first byte/chunk, delta field shapes."""
    body = {"model": MODEL, "messages": user_msg("Count from one to five, one number per line."),
            "max_tokens": 512, "stream": True}
    data = json.dumps(body).encode()
    req = urllib.request.Request(base_url() + "/chat/completions", data=data, method="POST",
                                 headers={"api-key": api_key(), "Content-Type": "application/json"})
    t0 = time.monotonic()
    ttft = None
    chunks = 0
    saw_reasoning_delta = False
    saw_content_delta = False
    saw_usage = False
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            status = resp.status
            headers = dict(resp.headers)
            for raw in resp:
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload in ("", "[DONE]"):
                    continue
                if ttft is None:
                    ttft = time.monotonic() - t0
                chunks += 1
                try:
                    j = json.loads(payload)
                except Exception:
                    continue
                delta = ((j.get("choices") or [{}])[0].get("delta") or {})
                if delta.get("reasoning_content") is not None:
                    saw_reasoning_delta = True
                if delta.get("content") is not None:
                    saw_content_delta = True
                if j.get("usage"):
                    saw_usage = True
        dt = time.monotonic() - t0
        say(f"evidence: p03 stream status={status} ttft={ttft and round(ttft, 2)}s total={dt:.2f}s "
            f"chunks={chunks} delta_reasoning_content={saw_reasoning_delta} "
            f"delta_content={saw_content_delta} usage_in_stream={saw_usage}")
        record("p03", {"label": "stream", "status": status, "ttft_s": ttft and round(ttft, 3),
                       "latency_s": round(dt, 3), "chunks": chunks,
                       "delta_reasoning_content": saw_reasoning_delta,
                       "delta_content": saw_content_delta, "usage_in_stream": saw_usage,
                       "headers": headers})
    except Exception as exc:
        say(f"evidence: p03 stream TRANSPORT_ERROR {type(exc).__name__}: {exc}")
        record("p03", {"label": "stream", "status": -1, "error": str(exc)})
    # non-stream baseline for latency comparison
    status, headers, text, dt = chat({"model": MODEL,
                                      "messages": user_msg("Count from one to five, one number per line."),
                                      "max_tokens": 512})
    summarize("p03", "non-stream baseline", status, headers, text, dt)


def p04_reasoning_content():
    """reasoning_content shape + the must-echo-back rule on a tool-call turn."""
    # (a) does a default (thinking-on) call return reasoning_content?
    status, headers, text, dt = chat({"model": MODEL,
                                      "messages": user_msg("What is 17 * 23? Think briefly, then answer."),
                                      "max_tokens": 1024})
    rec = summarize("p04", "reasoning_content present?", status, headers, text, dt)
    try:
        j = json.loads(text)
        msg = (j.get("choices") or [{}])[0].get("message") or {}
        say(f"evidence: p04 message_keys={sorted(msg.keys())} "
            f"has_reasoning_content={'reasoning_content' in msg}")
    except Exception:
        pass

    # (b) must-echo-back: replay a tool-call history WITHOUT reasoning_content.
    tool_turn = {
        "role": "assistant", "content": None,
        "tool_calls": [{
            "id": "call_probe_1", "type": "function",
            "function": {"name": "get_weather", "arguments": json.dumps({"location": "Beijing"})},
        }],
    }
    msgs_no_rc = [
        {"role": "user", "content": "What is the weather in Beijing?"},
        tool_turn,
        {"role": "tool", "tool_call_id": "call_probe_1", "content": '{"temp_c": 21, "sky": "clear"}'},
        {"role": "user", "content": "Summarize that in four words."},
    ]
    body = {"model": MODEL, "messages": msgs_no_rc, "max_tokens": 512,
            "tools": [{"type": "function", "function": {
                "name": "get_weather", "description": "Get weather for a location",
                "parameters": {"type": "object",
                               "properties": {"location": {"type": "string"}},
                               "required": ["location"]}}}]}
    status, headers, text, dt = chat(body)
    summarize("p04", "tool-turn WITHOUT reasoning_content", status, headers, text, dt)

    # (c) same history WITH reasoning_content echoed back.
    tool_turn_rc = dict(tool_turn)
    tool_turn_rc["reasoning_content"] = "The user wants the weather; I should call get_weather."
    body["messages"] = [
        {"role": "user", "content": "What is the weather in Beijing?"},
        tool_turn_rc,
        {"role": "tool", "tool_call_id": "call_probe_1", "content": '{"temp_c": 21, "sky": "clear"}'},
        {"role": "user", "content": "Summarize that in four words."},
    ]
    status, headers, text, dt = chat(body)
    summarize("p04", "tool-turn WITH reasoning_content", status, headers, text, dt)


def p05_tool_calls_round_trip():
    """Request -> tool_calls -> tool result -> final answer."""
    tools = [{"type": "function", "function": {
        "name": "get_weather", "description": "Get the current weather in a given location",
        "parameters": {"type": "object",
                       "properties": {"location": {"type": "string", "description": "City name"}},
                       "required": ["location"]}}}]
    body = {"model": MODEL, "tools": tools,
            "messages": user_msg("What is the weather in Tokyo? Use the tool."),
            "max_tokens": 1024}
    status, headers, text, dt = chat(body)
    rec = summarize("p05", "turn 1 (expect tool_calls)", status, headers, text, dt)
    try:
        msg = (json.loads(text).get("choices") or [{}])[0].get("message") or {}
    except Exception:
        msg = {}
    calls = msg.get("tool_calls") or []
    if not calls:
        say("evidence: p05 ROUND_TRIP_INCOMPLETE no tool_calls returned")
        return
    call = calls[0]
    cid = call.get("id") or "call_probe_rt"
    turn2 = [
        {"role": "user", "content": "What is the weather in Tokyo? Use the tool."},
        {"role": "assistant", "content": msg.get("content"),
         "tool_calls": [{"id": cid, "type": "function",
                         "function": {"name": call["function"]["name"],
                                      "arguments": call["function"]["arguments"]}}]},
        {"role": "tool", "tool_call_id": cid, "content": '{"temp_c": 26, "sky": "sunny"}'},
    ]
    if msg.get("reasoning_content") is not None:
        turn2[1]["reasoning_content"] = msg["reasoning_content"]
        say("evidence: p05 echo-back: reasoning_content from turn 1 attached to assistant tool turn")
    body2 = {"model": MODEL, "tools": tools, "messages": turn2, "max_tokens": 1024}
    status2, headers2, text2, dt2 = chat(body2)
    rec2 = summarize("p05", "turn 2 (tool result -> final answer)", status2, headers2, text2, dt2)
    say(f"evidence: p05 ROUND_TRIP complete={rec2['status'] == 200 and rec2['content_len'] > 0} "
        f"turn1_args={call['function']['arguments']}")

    # (c) strictness check: replay the SAME real history with reasoning_content stripped.
    turn2_stripped = [dict(m) for m in turn2]
    turn2_stripped[1].pop("reasoning_content", None)
    body3 = {"model": MODEL, "tools": tools, "messages": turn2_stripped, "max_tokens": 1024}
    status3, headers3, text3, dt3 = chat(body3)
    summarize("p05", "turn 2 replay WITHOUT reasoning_content (strictness check)",
              status3, headers3, text3, dt3)


def p06_parallel_tool_calls():
    """Can one assistant turn carry multiple tool_calls?"""
    tools = [{"type": "function", "function": {
        "name": "get_weather", "description": "Get the current weather in a given location",
        "parameters": {"type": "object",
                       "properties": {"location": {"type": "string"}},
                       "required": ["location"]}}},
        {"type": "function", "function": {
            "name": "get_time", "description": "Get the local time in a given city",
            "parameters": {"type": "object",
                           "properties": {"city": {"type": "string"}},
                           "required": ["city"]}}}]
    body = {"model": MODEL, "tools": tools, "max_tokens": 1024,
            "messages": user_msg("For BOTH Tokyo and Paris, get the weather AND the local time. "
                                 "Call every tool you need — you may call several tools.")}
    status, headers, text, dt = chat(body)
    rec = summarize("p06", "multi-tool request", status, headers, text, dt)
    try:
        msg = (json.loads(text).get("choices") or [{}])[0].get("message") or {}
        names = [c.get("function", {}).get("name") for c in (msg.get("tool_calls") or [])]
        say(f"evidence: p06 tool_calls_in_one_turn={len(names)} names={names}")
        record("p06", {"label": "names", "names": names})
    except Exception as exc:
        say(f"evidence: p06 parse error {exc}")


def p07_vision():
    """Vision via public image URL (official example image) and a base64 data URL."""
    body = {"model": MODEL, "max_tokens": 1024,
            "messages": [{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": EXAMPLE_IMAGE}},
                {"type": "text", "text": "Describe this image in one sentence."},
            ]}]}
    status, headers, text, dt = chat(body)
    summarize("p07", "vision via image URL", status, headers, text, dt)


def p08_context_edge():
    """1M-context edge: oversized prompt error shape + a normal prompt's accounting."""
    # (a) documented context window is 1M tokens; a prompt far beyond it must fail cleanly.
    filler = "The quick brown fox jumps over the lazy dog and counts numbers one two three four. "
    words = filler * 120000  # ~1.1M tokens of text, well past the documented window
    status, headers, text, dt = chat({"model": MODEL, "messages": user_msg(words), "max_tokens": 16},
                                     timeout=180.0)
    summarize("p08", "oversized prompt (~1.1M tokens)", status, headers, text, dt)

    # (b) normal accounting: same short prompt twice is p09's job; here just confirm counts.
    status, headers, text, dt = chat({"model": MODEL, "max_tokens": 64,
                                      "messages": user_msg("Say OK.")})
    summarize("p08", "tiny prompt accounting", status, headers, text, dt)


def p09_cached_tokens():
    """Repeat a large identical prefix; look for prompt_tokens_details.cached_tokens."""
    prefix = ("MiMo context-cache probe. Remember this block verbatim. " * 400)
    body = {"model": MODEL, "max_tokens": 32, "thinking": {"type": "disabled"},
            "messages": user_msg(prefix + " Answer with exactly: OK")}
    for i in (1, 2):
        status, headers, text, dt = chat(body)
        rec = summarize("p09", f"repeated prefix call {i}", status, headers, text, dt)
        try:
            u = (rec or {}).get("usage") or {}
            details = u.get("prompt_tokens_details") or {}
            say(f"evidence: p09 call{i} prompt_tokens={u.get('prompt_tokens')} "
                f"cached_tokens={details.get('cached_tokens')}")
        except Exception:
            pass


def p10_concurrency():
    """10 parallel calls: statuses, latency spread, any 429."""
    def one(i: int):
        return i, *chat({"model": MODEL, "messages": user_msg(f"Reply with exactly: P{i}"),
                         "max_tokens": 64, "thinking": {"type": "disabled"}}, timeout=120.0)
    t0 = time.monotonic()
    with cf.ThreadPoolExecutor(max_workers=10) as ex:
        results = list(ex.map(one, range(10)))
    wall = time.monotonic() - t0
    statuses = {}
    lat = []
    for i, status, headers, text, dt in results:
        statuses[status] = statuses.get(status, 0) + 1
        lat.append(dt)
        summarize("p10", f"parallel #{i}", status, headers, text, dt)
    say(f"evidence: p10 wall={wall:.2f}s statuses={statuses} "
        f"lat_min={min(lat):.2f}s lat_max={max(lat):.2f}s any_429={429 in statuses}")
    record("p10", {"label": "summary", "wall_s": round(wall, 3), "statuses": statuses,
                   "lat_min": min(lat), "lat_max": max(lat), "any_429": 429 in statuses})


def p11_error_shapes():
    """Bad model id, oversized max_tokens, and the /v1/models health check."""
    status, headers, text, dt = chat({"model": "mimo-v9-does-not-exist",
                                      "messages": user_msg("Say OK"), "max_tokens": 16})
    summarize("p11", "bad model id", status, headers, text, dt)

    status, headers, text, dt = chat({"model": MODEL, "messages": user_msg("Say OK"),
                                      "max_tokens": 200000})
    summarize("p11", "oversized max_tokens=200000", status, headers, text, dt)

    status, headers, text, dt = chat({"model": MODEL, "messages": user_msg("Say OK"),
                                      "max_completion_tokens": 200000})
    summarize("p11", "oversized max_completion_tokens=200000", status, headers, text, dt)

    status, headers, text, dt = get("/models")
    say(f"evidence: p11 GET /models status={status} body={text[:200]!r}")
    record("p11", {"label": "GET /models", "status": status, "body_head": text[:200]})


def p12_ultraspeed():
    """mimo-v2.6-pro-ultraspeed: does it answer on the token-plan host?"""
    status, headers, text, dt = chat({"model": ULTRASPEED,
                                      "messages": user_msg("Reply with exactly: OK"),
                                      "max_tokens": 64})
    summarize("p12", f"{ULTRASPEED} basic", status, headers, text, dt)
    status, headers, text, dt = chat({"model": ULTRASPEED, "tools": [{
        "type": "function", "function": {"name": "get_weather", "description": "weather",
                                         "parameters": {"type": "object", "properties": {
                                             "location": {"type": "string"}}}}}],
        "messages": user_msg("Weather in Oslo? Use the tool."), "max_tokens": 512})
    summarize("p12", f"{ULTRASPEED} tool call", status, headers, text, dt)


def p13_headers_accounting():
    """Token-plan accounting: response headers and usage accounting fields."""
    status, headers, text, dt = chat({"model": MODEL, "messages": user_msg("Say OK."),
                                      "max_tokens": 64})
    summarize("p13", "headers sample", status, headers, text, dt)
    interesting = {k: v for k, v in headers.items()
                   if re.search(r"rate|limit|quota|billing|credit|token|plan|x-", k, re.I)}
    say(f"evidence: p13 response_headers={json.dumps(interesting, ensure_ascii=False)}")
    try:
        u = json.loads(text).get("usage") or {}
        say(f"evidence: p13 usage_keys={sorted(u.keys())} full_usage={json.dumps(u, ensure_ascii=False)}")
    except Exception:
        pass


def p14_default_host_mismatch():
    """Plugin default host (api.xiaomimimo.com) vs token-plan host, same key."""
    import urllib.request as _u
    alt = "https://api.xiaomimimo.com/v1"
    for path, label in (("/models", "GET /models on pay-as-you-go host"),
                        ("/chat/completions", "POST chat on pay-as-you-go host")):
        url = alt + path
        if path.startswith("/chat"):
            data = json.dumps({"model": MODEL, "messages": user_msg("Say OK"), "max_tokens": 16}).encode()
            req = _u.Request(url, data=data, method="POST",
                             headers={"api-key": api_key(), "Content-Type": "application/json"})
        else:
            req = _u.Request(url, headers={"api-key": api_key()})
        t0 = time.monotonic()
        try:
            with _u.urlopen(req, timeout=30) as resp:
                status, body = resp.status, resp.read().decode("utf-8", "replace")[:200]
        except urllib.error.HTTPError as exc:
            status, body = exc.code, exc.read().decode("utf-8", "replace")[:200]
        except Exception as exc:
            status, body = -1, f"{type(exc).__name__}: {exc}"
        dt = time.monotonic() - t0
        say(f"evidence: p14 {label} status={status} latency={dt:.2f}s body={body!r}")
        record("p14", {"label": label, "status": status, "body_head": body,
                       "latency_s": round(dt, 3)})


PROBES = {
    "p01": p01_max_tokens_floor_thinking_on,
    "p02": p02_max_tokens_floor_thinking_off,
    "p03": p03_streaming_vs_non_stream,
    "p04": p04_reasoning_content,
    "p05": p05_tool_calls_round_trip,
    "p06": p06_parallel_tool_calls,
    "p07": p07_vision,
    "p08": p08_context_edge,
    "p09": p09_cached_tokens,
    "p10": p10_concurrency,
    "p11": p11_error_shapes,
    "p12": p12_ultraspeed,
    "p13": p13_headers_accounting,
    "p14": p14_default_host_mismatch,
}


def main(argv: list[str]) -> int:
    if "--list" in argv:
        for name, fn in PROBES.items():
            print(name, "-", (fn.__doc__ or "").strip())
        return 0
    if not api_key():
        print("mimo-probe: XIAOMI_API_KEY missing (env or XIAOMI_API_KEY_FILE)", file=sys.stderr)
        return 2
    say(f"# mimo-probe base={base_url()} model={MODEL} key_format={api_key()[:3]}****")
    wanted = [a for a in argv if not a.startswith("-")] or list(PROBES)
    for name in wanted:
        fn = PROBES.get(name)
        if fn is None:
            print(f"mimo-probe: unknown probe {name!r}", file=sys.stderr)
            continue
        say(f"\n## {name}: {(fn.__doc__ or '').strip()}")
        try:
            fn()
        except Exception as exc:
            say(f"evidence: {name} PROBE_CRASHED {type(exc).__name__}: {exc}")
            record(name, {"label": "crash", "error": f"{type(exc).__name__}: {exc}"})
    say(f"\n# done; full log: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
