# MiMo harness guide — official rules, measured quirks, Hermes config

**Scope.** How to harness Xiaomi MiMo correctly: what the creators document, what we measured, and how Hermes Agent should be configured. Every claim below carries either a numbered doc citation (Sources at the bottom) or a `probe pNN` reference into `scripts/mimo-probe.py` / `scripts/mimo-probe-results.jsonl` (49 recorded calls, 2026-10-29, token-plan Singapore cluster, `mimo-v2.6-pro`, key format `tp-`). Reproduce with `python3 scripts/mimo-probe.py` (stdlib only; needs `XIAOMI_API_KEY`).

Closes #37.

---

## 1. Official rules (creators first)

### 1.1 Billing modes and hosts

Two independent billing modes with independent credentials, which cannot be mixed [10][11][7]:

| Mode          | OpenAI-compatible base URL                                                                                                                                          | Key format                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Pay-as-you-go | `https://api.xiaomimimo.com/v1`                                                                                                                                     | `sk-xxxxx` [10]                              |
| Token Plan    | `https://token-plan-cn.xiaomimimo.com/v1` (China), `https://token-plan-sgp.xiaomimimo.com/v1` (Singapore), `https://token-plan-ams.xiaomimimo.com/v1` (Europe) [11] | `tp-xxxxx` individual, `ttp-xxxxx` team [11] |

> "The API Key for the Token Plan (`tp-xxxxx` or `ttp-xxxxx`) and the API Key for pay-as-you-go API calls (`sk-xxxxx`) are independent of each other and cannot be used interchangeably." [11] Mixing them is a documented 401 cause ("API Key that mixes Token Plan and Pay-as-you-go API") [7]. Anthropic-compatible endpoints exist per cluster (`…/anthropic`) [10][11]; a batch host exists for pay-as-you-go (`batch-api-cn`) [10]. Token Plan keys die with the subscription ("The API Key of the Token Plan is only valid during the subscription period") [11].

### 1.2 Models and hard limits

- Model IDs on `/chat/completions`: `mimo-v2.6-flash`, `mimo-v2.6-pro`, `mimo-v2.6-pro-ultraspeed` [1]. `mimo-v2.5-pro` and `mimo-v2.5` were deprecated 2026-10-21 10:00 (UTC+8) and their IDs no longer work [9][14].
- Context window 1M tokens, maximum output 128K for the v2.6 text models [9].
- Rate limits: `mimo-v2.6-pro` and `mimo-v2.6-flash` — RPM 100, TPM 10M, counted per account across all API keys on the same model [6][9]. `mimo-v2.6-pro-ultraspeed`: "Reserved quota (contact us for more)" [6][9].
- `max_completion_tokens` — "An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens", default `131072`, "Required range: `[1, 131072]`" for all three v2.6 models [1].
- `temperature` — default `1.0`, "Required range: `[0, 1.5]`"; `top_p` — default `0.95`, "Required range: `[0.01, 1.0]`" [1][5].
- `frequency_penalty` / `presence_penalty` — "Required range: `[-2.0, 2.0]`" [1].
- `stop` — "Up to 4 sequences where the API will stop generating further tokens" [1].
- `response_format` — `text` (default) or `json_object`; "the model will not generate JSON without a system or user message instructing it to do so" [1].
- `tool_choice` — the only documented option is `auto`; "When a value other than `auto` is passed to `tool_choice`, the backend will remove this field by default, and the model response behavior will still be equivalent to the `auto` mode" [1].
- Auth headers: `api-key: $MIMO_API_KEY` **or** `Authorization: Bearer $MIMO_API_KEY` [1][8].

### 1.3 Thinking / reasoning control

- `thinking.type` ∈ {`enabled`, `disabled`}; default `enabled` on all three v2.6 models [1][3]. Via the OpenAI Python SDK it must go in `extra_body` ("The `thinking` field is not a standard OpenAI parameter") [3]. There is no effort dial on the chat endpoint: the Responses endpoint documents `reasoning.effort` where "`none` disables thinking; Every other level enables thinking with identical behavior" [2].
- In thinking mode the v2.6 models "do not support customizing the `temperature` and `top_p` parameters. Even if these parameters are passed in, the actual effective values will be forcibly set by the model to its recommended default values of `1.0` and `0.95`" [1][5].
- `max_completion_tokens` "limits the total length of thinking content and the final answer" — thinking eats the output budget [3].
- Response field `reasoning_content` (message and streaming delta) holds "The reasoning contents of the assistant message, before the final answer" [1].
- Multi-turn tool calls in thinking mode: the model returns `reasoning_content` alongside `tool_calls`, and the docs say historical `reasoning_content` **must** be passed back in later rounds "otherwise the API will return a 400 error" [3]; the error-code page lists the same rule under 400 - Invalid Format [7]. Missing history "may result in decreased instruction following and increased hallucinations" [3]. _Divergence: we could not reproduce the 400 — see quirk Q6._[15]

### 1.4 Tool calling and streaming

- `tools` — "A list of tools the model may call. You can provide function tools" (OpenAI function-tool shape) [1]; official examples round-trip `tool_calls` → `role: tool` result → final answer [1][3].
- Streaming: `stream: true` streams server-sent events [1]; "thinking content and answer content are output sequentially: first, the thinking process is returned step-by-step via `reasoning_content`, and after thinking is complete, the final answer is output step-by-step via `content`" [3]. `stream: true` is recommended for thinking-mode latency [3].

### 1.5 Vision

- Input parts: `{"type": "image_url", "image_url": {"url": …}}` with either a public URL or a base64 data URL (`data:{MIME_TYPE};base64,$BASE64_IMAGE`) [4].
- Formats "JPEG, PNG, GIF, WebP, BMP"; "When passed in as a URL: single image file size does not exceed 50 MB"; same 50 MB cap on the base64 string; image count is bounded only by the context window [4]. A 404 means "The requested endpoint or model does not support image input capability" [7].

### 1.6 Errors and accounting

- Error table: 400 Invalid Format (includes missing `reasoning_content` on tool turns and multimodal input problems), 401 Authentication Fails (bad key **or** mixed Token Plan / pay-as-you-go key), 402 Insufficient Balance, 403 Forbidden (region / risk control), 404 Not Found (no image capability), 421 Content Filter, 429 Too Many Requests ("Requests are too frequent, or the quota of Token Plan has been exhausted"), 500, 503 [7].
- Token Plan credit burn (per token class): `mimo-v2.6-pro` input cache-hit 2.5 credits, input cache-miss 300, output 600; `mimo-v2.6-flash` 2 / 100 / 200; off-peak coefficient 0.8× during Beijing 00:00–08:00 (UTC 16:00–24:00) [12].
- `usage` carries `completion_tokens_details.reasoning_tokens` and `prompt_tokens_details.cached_tokens` [1]. `GET /v1/models` lists models [8].

---

## 2. Measured probes (evidence)

`scripts/mimo-probe.py` (stdlib `urllib`, no dependencies) recorded 49 calls across 14 probe groups into `scripts/mimo-probe-results.jsonl`.[15] Selected lines:

| Probe                                                | Evidence line (abridged from the run)                                                                             | Verdict                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| p01 thinking-on max_tokens sweep                     | `max_tokens=8 status=200 empty_content=True finish=length usage.completion_tokens=8 reasoning_tokens=11`          | thinking eats the budget; content vanishes first                      |
| p01                                                  | `max_tokens=16 … content_len=2 finish=stop`                                                                       | first non-empty answer at 16 for a 2-token reply                      |
| p01                                                  | `max_tokens=2 … completion_tokens=2 reasoning_tokens=4`                                                           | `reasoning_tokens` can exceed `max_tokens`                            |
| p02 thinking-off sweep                               | `max_tokens=1 status=200 content_len=2 finish=length`                                                             | no floor with thinking disabled                                       |
| p03 streaming                                        | `status=200 ttft=2.13s total=2.80s chunks=8 delta_reasoning_content=True delta_content=True usage_in_stream=True` | reasoning deltas first, usage in stream                               |
| p03 non-stream baseline                              | `latency=3.37s … reasoning_len=65`                                                                                | non-stream slightly slower on this task                               |
| p04 shape                                            | `message_keys=['content','reasoning_content','role','tool_calls']`                                                | `reasoning_content` is a sibling of `content`                         |
| p04 fabricated tool turn without `reasoning_content` | `status=200`                                                                                                      | documented 400 not enforced (Q6)                                      |
| p05 real round-trip                                  | turn1 `finish=tool_calls tool_calls=1 turn1_args={"location":"Tokyo"}`; turn2 `finish=stop content_len=75`        | tool round-trip works end to end                                      |
| p05 strictness                                       | real history replayed **without** `reasoning_content`: `status=200 content_len=75`                                | 400 rule unenforced on this gateway                                   |
| p06 parallel tools                                   | `tool_calls_in_one_turn=4 names=['get_weather','get_time','get_weather','get_time']`                              | multiple tool calls per turn work                                     |
| p07 vision                                           | `status=200 … image_tokens=1024 prompt_tokens=1040`                                                               | URL vision works; image tokens reported                               |
| p08 ~1.1M-token prompt                               | `status=200 prompt_tokens=1048570 completion_tokens=0 finish=length empty_content=True`                           | no 400 — input silently clipped to the window (Q1)                    |
| p09 repeated 4.8k-token prefix                       | call1 `cached_tokens=0`; call2 `cached_tokens=4736` of `prompt_tokens=4815`                                       | prompt cache works, no minimum ≥ 4.8k                                 |
| p10 concurrency                                      | `wall=2.97s statuses={200: 10} lat_min=2.20s lat_max=2.96s any_429=False`                                         | 10 parallel calls all fine                                            |
| p11 bad model id                                     | `400 {"code":"400","message":"Unsupported model mimo-v9-does-not-exist"}`                                         | model checked first                                                   |
| p11 oversized cap                                    | `400 … "max_tokens is too large: 200000. This model supports at most 131072 completion tokens…"`                  | `max_tokens` accepted as the documented `max_completion_tokens` alias |
| p11 `GET /models` (token-plan host)                  | `status=200`                                                                                                      | health check works here                                               |
| p12 ultraspeed                                       | `400 {"code":"400","message":"Not supported model mimo-v2.6-pro-ultraspeed"}`                                     | not served on the token-plan SGP cluster (Q5)                         |
| p13 headers                                          | `response_headers={"X-MiFE-Upstream-Status": "200"}`                                                              | no rate-limit/quota/billing headers exposed                           |
| p14 pay-as-you-go host with `tp-` key                | `GET /models 401`, `POST chat 401 {"message":"Invalid API Key"}`                                                  | the plugin-default host rejects token-plan keys (Q7)                  |

---

## 3. Quirks table (symptom → cause → rule)

| #   | Symptom                                                                                                                                                            | Cause                                                                                                                                                 | Rule to code                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | A prompt near/over 1M tokens returns 200 with `finish=length`, `completion_tokens=0`, and a _silently shortened_ answer window (`prompt_tokens=1048570`, no error) | The gateway clips input to the context window instead of rejecting it (p08); docs say context window is 1M [9]                                        | Never rely on an over-limit 400. Size prompts explicitly and check `usage.prompt_tokens` against the intended size; a `completion_tokens=0` + `finish=length` reply is a context blow-out, not an outage                  |
| Q2  | 200 OK but **empty content** at small `max_tokens` (we measured empty at 8 and below; first content at 16 for a 2-token answer)                                    | Thinking is on by default [1][3] and "thinking content and the final answer" share `max_completion_tokens` [3]; reasoning consumes it all (p01)       | With thinking enabled never send `max_tokens` under ~1024 (that leaves real answer room); for small budgets send `"thinking": {"type": "disabled"}` (p02 works at 1)                                                      |
| Q3  | `usage.completion_tokens_details.reasoning_tokens` is **larger** than `max_tokens` (11 > 8 at `max_tokens=8`, p01)                                                 | Reasoning accounting is not clamped by the request cap the way visible content is (p01)                                                               | Do not validate budgets against `reasoning_tokens`; treat it as telemetry, and don't promise "≤ N tokens" while thinking is on                                                                                            |
| Q4  | `temperature`/`top_p` settings have no effect in thinking mode                                                                                                     | Forced to `1.0`/`0.95` server-side [1][5]                                                                                                             | Don't send sampling params for thinking calls; if you need determinism, disable thinking [1]                                                                                                                              |
| Q5  | `mimo-v2.6-pro-ultraspeed` → 400 `Not supported model`                                                                                                             | Not served on the token-plan SGP cluster; docs say its rate quota is "Reserved quota (contact us)" [6][9] (p12)                                       | Don't put `ultraspeed` in any model list for token-plan hosts; keep it out of fallback chains                                                                                                                             |
| Q6  | Docs promise a 400 when `reasoning_content` is missing on tool-call turns [3][7]; we measured 200 with and without it (p04, p05)                                   | Enforcement gap (or scope we didn't reproduce) on the token-plan SGP gateway                                                                          | Still echo `reasoning_content` back (docs warn of degraded instruction-following [3] and the rule may be enforced elsewhere), but code retries around a 400 for it defensively — don't _depend_ on the 400 as a validator |
| Q7  | 401 `Invalid API Key` from `api.xiaomimimo.com` even with a valid token-plan key                                                                                   | Host/key-type pairing: `tp-` keys only authenticate on the token-plan cluster hosts [11][7] (p14)                                                     | Pin `XIAOMI_BASE_URL` to the cluster host that matches the key format; the plugin default host is wrong for token-plan                                                                                                    |
| Q8  | `GET /models` 401s (why Hermes disables its health check)                                                                                                          | True on the pay-as-you-go host (p14, and the plugin comment at `__init__.py:9`); but it returns **200** on the token-plan host with a `tp-` key (p11) | Health checks are usable when the base URL is a token-plan host; keep them off otherwise                                                                                                                                  |
| Q9  | `reasoning_tokens`, `cached_tokens` are the only accounting surfaces                                                                                               | No rate-limit/quota/billing headers on responses (p13); quota exhaustion surfaces as 429 [7]                                                          | Budget from `usage` JSON plus the Token Plan credit table [12], and treat 429 as "slow down **or** plan exhausted" [7]                                                                                                    |

---

## 4. Hermes config recommendation

Hermes-side facts (this repo's harness), with file:line. Xiaomi's own Hermes Agent setup guide confirms the base_url/key pairing and the switch procedure between the two billing modes [13].

- `plugins/model-providers/xiaomi/__init__.py:8` — plugin default `base_url` `https://api.xiaomimimo.com/v1` (pay-as-you-go host). A `tp-` key gets 401 there (Q7, p14), so the working endpoint must come from `XIAOMI_BASE_URL` (`hermes_cli/providers.py:63` wires `HermesOverlay(base_url_env_var="XIAOMI_BASE_URL")`; `hermes_cli/config_defaults.py:2815-2818` documents the override). Our `.env` sets `XIAOMI_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1`, which is what made this session's calls work.[15]
- `plugins/model-providers/xiaomi/__init__.py:9` — `supports_health_check=False` with the comment "/v1/models returns 401 even with valid key". Accurate for the pay-as-you-go host (p14), stale for the token-plan host (p11: `GET /models` → 200).[15]
- `plugins/model-providers/xiaomi/__init__.py:10-11` — `supports_vision=True` (confirmed: mimo-v2.6-pro answered an image-URL prompt, p07) and `supports_vision_tool_messages=False` ("rejects list-type tool content (400 text is not set)"), consistent with the tool-role `content` being plain text in the schema [1].
- What Hermes actually puts on the wire for MiMo:
- **`max_tokens`** (not `max_completion_tokens`): `run_agent.py:659-671` (`_max_tokens_param`) picks `max_completion_tokens` only for direct OpenAI/Azure or a profile declaring it (`providers/base.py:472-478`); the xiaomi plugin declares nothing, so the key is `max_tokens`. MiMo accepts that alias (p11 echoes it in the range error), but the documented name is `max_completion_tokens` [1] — an upstream that only honours the documented name would silently ignore Hermes' cap.
- **No cap at all by default**: `_apply_max_tokens` (`agent/transports/chat_completions.py:376-384`) sends nothing when neither the user nor the profile sets a value → server default 131072 [1]. Fine — but any path that sets a small `max_tokens`/`ephemeral_max_output_tokens` on a thinking call can trip Q2.
- **No temperature**: the profile path omits it unless configured (`agent/transports/chat_completions.py:388-403`), which matches Q4 (thinking forces 1.0/0.95 anyway [5]).
- **No thinking/reasoning control**: `agent.reasoning_effort: "high"` (config) is dropped — `providers/base.py:351-369` `build_api_kwargs_extras` defaults to `({}, {})` and the xiaomi plugin overrides nothing, so no `thinking`/`reasoning` field reaches MiMo and thinking stays at its documented default `enabled` [1][3]. MiMo's chat endpoint has no effort dial anyway [2]; only on/off is expressible (`thinking.type`) [1][3].
- **`reasoning_content` replay is already correct**: `agent/message_sanitization.py:656` has a mimo row in `_REASONING_ECHO_RULES` (providers `{xiaomi}`, model marker `mimo`, hosts `xiaomimimo.com`) that echoes `reasoning_content` on tool turns and pads ` " "` on reasoning-less ones — exactly the docs' pass-back requirement [3][7].

**Recommendations** (approved on the desktop side by the operator as written):

1. **base_url** — keep `XIAOMI_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1` in `~/.hermes/.env` (cluster must match the account's Token Plan page [11]); never run a `tp-`/`ttp-` key against the plugin default host (Q7). If we ever move to pay-as-you-go, switch both the host and the key together [11].
2. **max_tokens floor** — treat 1024 as the minimum whenever thinking is enabled (Q2); for deliberately small budgets (titles, summaries in a tight cap) disable thinking per request (`extra_body={"thinking": {"type": "disabled"}}`) [3] rather than shrinking the cap. A longer-term fix is a xiaomi plugin `get_max_tokens()` floor (`providers/base.py:400-412`) or a `max_tokens_param` declaration (`providers/base.py:472-478`) mapping to `max_completion_tokens` [1].
3. **Vision on** — keep `supports_vision=True` (p07).[15] MiMo bills image tokens in `prompt_tokens_details.image_tokens` and the docs cap single images at 50 MB [4]. Keep `supports_vision_tool_messages=False` (plugin `__init__.py:11`): tool-role content stays plain text [1].
4. **Fallback eligibility** — MiMo v2.6-pro is a **good mid-chain fallback** (already 4th in `fallback_providers`): 10/10 parallel calls at ~2.2–3.0 s (p10), 1M context [9], token cache hits cheap on Token Plan [12]. Keep it behind a lower-latency first fallback; a 429 here means either throttling or exhausted plan quota [7] and should fail over, not retry hot. `ultraspeed` is not fallback-eligible at all (Q5).
5. **Health check** — when `XIAOMI_BASE_URL` is a token-plan host, `/models` works (p11);[15] the plugin could re-enable `supports_health_check` conditionally (open item, plugin `__init__.py:9`).
6. **Don't rely on the 400 validator** for `reasoning_content` (Q6), but keep the echo behavior (`message_sanitization.py:656`) — it is documented as required [3] and may be enforced on other clusters.

## 5. Do not use MiMo for / do not do with MiMo

- **Do not** send `mimo-v2.5-pro` / `mimo-v2.5` — retired 2026-10-21, IDs dead [9][14].
- **Do not** use `mimo-v2.6-pro-ultraspeed` on token-plan hosts (400, p12); its quota is reserved/custom anyway [6][9].
- **Do not** pass `tool_choice` other than `auto` and expect forced tool use — the backend strips it and behaves as `auto` [1].
- **Do not** tune `temperature`/`top_p` for thinking calls — forced to 1.0/0.95 [1][5]; and don't assume `response_format: json_object` works without an instruction to emit JSON [1].
- **Do not** run small `max_tokens` budgets with thinking on — empty 200s (Q2).[15]
- **Do not** treat an over-long prompt as a guaranteed 400 — it is silently clipped (Q1).[15]
- **Do not** mix `sk-` and `tp-`/`ttp-` keys with hosts — 401 [7][11], and don't expect a token-plan key to survive subscription expiry [11].
- **Do not** depend on response headers for quota accounting — none are exposed (p13); burn rates are the credit table [12].
- **Do not** use MiMo where a hard per-call latency SLO applies without streaming: thinking runs 2–3 s to first token and up to ~13 s for vision (p03, p07) [3].

## 6. Open items (not measured here)

- The documented 400 on missing `reasoning_content` (Q6) was not reproducible on the token-plan SGP cluster; untested on `token-plan-cn`/`-ams` and pay-as-you-go.
- Whether the same clip-to-window behavior (Q1) applies to the pay-as-you-go host (no `sk-` key available here).
- Token-plan credit accounting in response payloads (p13 shows only token counts; credits are visible on the console progress bar [12]).
- Web-search plugin params (`max_keyword` [1,50], `limit` [1,50]) [1] — documented, not probed.

## Sources

[1] https://mimo.mi.com/docs/en-US/api/chat/openai-api — MiMo OpenAI Chat Completions API compatibility
> "An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens."
> "Up to 4 sequences where the API will stop generating further tokens."
> "The reasoning contents of the assistant message, before the final answer."
> "This parameter is used to control whether the model enables the chain of thought."
> [2] https://mimo.mi.com/docs/en-US/api/chat/responses — MiMo OpenAI Responses API compatibility
> "`none` disables thinking; Every other level enables thinking with identical behavior"
> [3] https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/deep-thinking — MiMo Deep Thinking
> "`max_completion_tokens` limits the total length of thinking content and the final answer."
> "In deep thinking, `mimo-v2.6-flash`, `mimo-v2.6-pro`, `mimo-v2.6-pro-ultraspeed` models do not support custom `temperature` and `top_p` parameters."
> [4] https://mimo.mi.com/docs/en-US/quick-start/usage-guide/multimodal-understanding/image-understanding — MiMo Image Understanding
> "The file size of a single image cannot exceed 50 MB."
> "Image Formats: JPEG, PNG, GIF, WebP, BMP."
> [5] https://mimo.mi.com/docs/en-US/api/guidance/model-hyperparameters — MiMo Model Hyperparameters
> "In thinking mode, the `mimo-v2.6-flash`, `mimo-v2.6-pro`, `mimo-v2.6-pro-ultraspeed` models do not support customizing the `temperature` and `top_p` parameters."
> [6] https://mimo.mi.com/docs/en-US/api/guidance/rate-limit — MiMo Rate Limit
> "The platform sets a model concurrency limit for each account."
> "The maximum number of requests initiated per minute."
> [7] https://mimo.mi.com/docs/en-US/api/guidance/error-codes — MiMo Error Codes
> "API Key that mixes Token Plan and Pay-as-you-go API"
> "Requests are too frequent, or the quota of Token Plan has been exhausted"
> [8] https://mimo.mi.com/docs/en-US/api/model/list-models — MiMo List Models
> "The model identifier, which can be referenced in the API endpoints."
> [9] https://mimo.mi.com/docs/en-US/quick-start/summary/model — MiMo Models overview
> "were officially deprecated at 10:00 (Beijing time) on October 21,2026"
> "Context Window: 1M"
> [10] https://mimo.mi.com/docs/en-US/quick-start/summary/first-api-call — MiMo First API call (billing modes)
> "Charged based on actual usage, suitable for light use"
> "Fixed subscription fee, with limited calls based on the package"
> [11] https://mimo.mi.com/docs/en-US/tokenplan/Token%20Plan/quick-access — MiMo Token Plan Quick Access
> "The API Key of the Token Plan is only valid during the subscription period, and you need to renew the subscription to continue using it after it expires."
> "are independent of each other and cannot be used interchangeably"
> [12] https://mimo.mi.com/docs/en-US/quick-start/faq/token-plan/Usage&Quota — MiMo Token Plan Usage & Quota
> "the Credit consumption coefficient will be 0.8 times when using the model during off-peak hours (Beijing time 00:00-08:00, i. e. UTC 16:00-24:00)."
> [13] https://mimo.mi.com/docs/en-US/tokenplan/integration/hermes-agent — MiMo Token Plan Hermes Agent integration
> "Edit `~/.hermes/.env` file, replace `XIAOMI_API_KEY` and `XIAOMI_BASE_URL` with Token Plan credentials"
> [14] https://mimo.mi.com/docs/en-US/updates/deprecate — MiMo Model Deprecation
> "Deprecation Time: The time when the name of the old model expires. After this time, requests using the name of the old model version will receive an error message."
> [15] file:///home/jadenblack/.hermes/kanban/boards/alignsynch/workspaces/t_c1266576/alignsynch/scripts/mimo-probe-results.jsonl — mimo-probe.py measured results (49 calls, 2026-10-29)
> ""probe": "p10", "label": "summary", "wall_s": 2.966, "statuses": {"200": 10}, "lat_min": 2.2021263150963932, "lat_max": 2.956114921020344, "any_429": false"
