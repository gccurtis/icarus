# intelligence — what the suite does

Source: [dev-test/intelligence/run.sh](../../../../dev-test/intelligence/run.sh)

The boundary itself: three endpoints — reason, infer, embed — and the cast that
routes each to a model. This suite tests the gate and the routing, not the
quality of anything a model says.

It is the one intelligence suite that runs in both modes. With a key, each kind
makes a real call. Without one, the same requests must fail in the specific way
that says "no credential" rather than "no such cast".

## Setup

Start the service against the shipped manifest. No project is needed — these
routes are session-gated, not Project-scoped.

Two casts are used throughout:

| Name | Cast | Why |
| --- | --- | --- |
| configured | `general` / low / high / low | The shipped config fills all 27 general coordinates for reasoning and inference, so this always resolves. |
| unconfigured | `code` / low / high / low | An unconfigured cast has to differ by **purpose**: only embedding carries a `code` purpose, and nothing serves code-purpose inference. |

## Step 1 — anonymous requests are refused

`POST /intelligence/infer` with the configured cast, no session.

- Asserts 401
- Asserts the body says `sign in required`

**Model calls:** none. The gate rejects before routing.

## Step 2 — sign in

Register and log in `dev@taurus.local`.

## Step 3 — an unconfigured cast is refused with a clear error

`POST /intelligence/infer` with the `code`-purpose cast.

- Asserts 400
- Asserts the body says `no model configured`

This is the assertion that keeps the next one honest. A 400 here and a 503 in the
no-key path are different failures — one means the cast has no row, the other
means the row exists and the provider has no credential — and collapsing them
would hide a misconfigured deployment behind a missing key.

## Step 4a — with a key: each kind makes a real call

Three requests, each with one bounded retry if the provider itself returns 5xx.
A single upstream hiccup on a trivial call should not fail the suite; a provider
that is actually down still does.

| Endpoint | Message | Asserts |
| --- | --- | --- |
| `/intelligence/reason` | `Reply with the single word: pong` | 200, body has `"text"` |
| `/intelligence/infer` | `Reply with the single word: pong` | 200, body has `"text"` |
| `/intelligence/embed` | input `hello world` | 200, body has `"vectors":[[` |

The prompts are trivial on purpose. What is under test is that a cast resolves to
a live model and the response comes back in the right shape.

**Model calls:** one reasoning, one inference, one embedding.

## Step 4b — without a key: the provider reports itself unavailable

`POST /intelligence/infer` with the configured cast.

- Asserts 503
- Asserts the body says `not configured`

## The prompts this suite exercises

None. This suite calls the intelligence boundary directly, so no system prompt is
involved — the messages above are the entire input. That is what makes it a test
of routing rather than of behaviour.

## How to read a failure

- Step 1 failing is an authorization gap on a route that spends money.
- Step 3 returning 503 instead of 400 means a cast that should be absent has a
  row, or the error mapping collapsed two distinct conditions.
- Step 4a failing after the retry means the provider is down or the model id in
  the shipped config no longer exists upstream. Check the model name before
  assuming a platform bug.
