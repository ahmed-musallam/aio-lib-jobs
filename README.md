<div id="top">

<!-- HEADER STYLE: CLASSIC -->
<div align="center">

# <code>❯ aio-lib-jobs</code>

<em>Submit long-running work from an Adobe App Builder web action, hand it off to a non-blocking worker action, and track its status — so you only write the job logic.</em>

<em>Built with the tools and technologies:</em>

<img src="https://img.shields.io/badge/JSON-000000.svg?style=default&logo=JSON&logoColor=white" alt="JSON">
<img src="https://img.shields.io/badge/npm-CB3837.svg?style=default&logo=npm&logoColor=white" alt="npm">
<img src="https://img.shields.io/badge/Hono-E36002.svg?style=default&logo=Hono&logoColor=white" alt="Hono">
<img src="https://img.shields.io/badge/Vitest-6E9F18.svg?style=default&logo=Vitest&logoColor=white" alt="Vitest">
<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=default&logo=TypeScript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Vite-646CFF.svg?style=default&logo=Vite&logoColor=white" alt="Vite">

</div>
<br>

---

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Features](#features)
- [Design Notes](#design-notes)
- [Project Structure](#project-structure)
    - [Project Index](#project-index)
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Usage](#usage)
    - [Testing](#testing)
- [Roadmap / Known Limitations](#roadmap--known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

In Adobe App Builder / I/O Runtime, exposing a long-running process as an API forces you to split work across two actions: web actions are synchronous with a **60 second** ceiling, while non-blocking (async) invocations can run up to **180 minutes**. Every team ends up hand-rolling the same boilerplate — a web action that accepts a request, fires a non-web worker action non-blocking, returns a job id immediately, and can be polled for status; plus a worker action that does the work and maintains that status.

`aio-lib-jobs` abstracts that handoff and status-tracking so you only write the job logic. It provides:

- a submit-side client (`init()`) for kicking off a job and polling/cancelling/reporting on it, with an optional composable [Hono](https://hono.dev) router for the common case, and
- a worker-side wrapper (`runWorker()`) that turns a plain async function into a status-tracked worker action.

---

## Features

- **Non-blocking handoff** - `submit()` invokes the worker via the `openwhisk` client with `blocking: false` and returns immediately with a job id.
- **Self-deriving job ids** - `jobId` is `<prefix>.<activationId>`, where `prefix` is auto-derived from the worker action's own fully-qualified name. No consumer-supplied ids to manage.
- **Race-free state model** - `@adobe/aio-lib-state` has no compare-and-swap, so each piece of job state lives in its own key with exactly one writer: the worker owns the main record, the submitter owns `submittedAt`, and the cancel route owns the cancel flag. Nothing can silently stomp a result.
- **Cooperative cancellation** - `cancelUrl` sets a flag; a worker's job function can check `ctx.isCancelled()` and exit early. OpenWhisk has no API to force-stop a running activation, so this is deliberately best-effort, not a kill switch.
- **Read-time timing, not heartbeats** - `queuedMs`, `elapsedMs`, and a computed `stale` flag are derived from stored timestamps at poll time; nothing needs a background heartbeat to detect a dead worker.
- **Prefix-scoped reporting** - `report()` lists every job for a given worker action via a single glob-scoped `list()` call, including jobs still `queued`.
- **Bring your own auth** - `router()` returns a plain composable `Hono` instance (it never calls `ToOpenWhiskAction()` itself), so you can wrap it with `hono/bearer-auth` or any other Hono middleware before mounting it.
- **Zero-config status URLs** - `statusUrl`/`cancelUrl` are built from `__OW_API_HOST` + `__OW_ACTION_NAME`, the action's own runtime environment - no base-URL configuration and no header-sniffing.

---

## Design Notes

This library assumes exactly one non-blocking worker invocation per job (no fan-out), that authentication on the submit/status/cancel/report routes is the consumer's responsibility, and that a job's result must fit within `@adobe/aio-lib-state`'s 1MB value limit (large results should be written to `@adobe/aio-lib-files` with only a reference stored in job state).

---

## Project Structure

```sh
└── aio-lib-jobs/
    ├── LICENSE
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── src
    │   ├── index.ts          # Public exports
    │   ├── client.ts         # init(): submit / getStatus / cancel / report / router
    │   ├── worker.ts         # runWorker(): status-tracked worker wrapper
    │   ├── job-id.ts         # Prefix derivation + jobId compose/parse
    │   ├── keys.ts           # State key builders (main / submittedAt / cancel)
    │   ├── timing.ts         # queuedMs / elapsedMs / stale computation
    │   ├── urls.ts           # statusUrl / cancelUrl construction
    │   ├── codec.ts          # JSON encode/decode for state values
    │   ├── errors.ts         # JobsLibError + error codes
    │   ├── types.ts          # Shared domain types
    │   ├── state-client.ts   # Narrow @adobe/aio-lib-state interface
    │   └── ow-client.ts      # Narrow openwhisk interface
    └── test
        ├── *.test.ts         # Unit tests per module above
        └── helpers/          # In-memory fakes for StateClient / OwClient
```

### Project Index

<details open>
	<summary><b><code>src/</code></b></summary>
	<blockquote>
		<table style='width: 100%; border-collapse: collapse;'>
		<thead>
			<tr style='background-color: #f8f9fa;'>
				<th style='width: 30%; text-align: left; padding: 8px;'>File</th>
				<th style='text-align: left; padding: 8px;'>Summary</th>
			</tr>
		</thead>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/index.ts'>index.ts</a></b></td><td style='padding: 8px;'>Public package exports.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/client.ts'>client.ts</a></b></td><td style='padding: 8px;'><code>init()</code> - builds the submit-side client: <code>submit</code>, <code>getStatus</code>, <code>cancel</code>, <code>report</code>, <code>router</code>.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/worker.ts'>worker.ts</a></b></td><td style='padding: 8px;'><code>runWorker()</code> - wraps a job function as a status-tracked worker action.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/job-id.ts'>job-id.ts</a></b></td><td style='padding: 8px;'>Derives a state-key-safe prefix from an action name and composes/parses <code>jobId</code>.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/keys.ts'>keys.ts</a></b></td><td style='padding: 8px;'>Builds the three per-job state keys (main record, <code>submittedAt</code>, <code>cancel</code>) and the report glob pattern.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/timing.ts'>timing.ts</a></b></td><td style='padding: 8px;'>Computes <code>queuedMs</code>, <code>elapsedMs</code>, and <code>stale</code> from stored timestamps.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/urls.ts'>urls.ts</a></b></td><td style='padding: 8px;'>Builds absolute <code>statusUrl</code>/<code>cancelUrl</code> from <code>__OW_API_HOST</code> + <code>__OW_ACTION_NAME</code>.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/codec.ts'>codec.ts</a></b></td><td style='padding: 8px;'>JSON encode/decode helpers, since <code>aio-lib-state</code>'s <code>put()</code> only accepts strings.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/errors.ts'>errors.ts</a></b></td><td style='padding: 8px;'><code>JobsLibError</code> and its error codes.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/types.ts'>types.ts</a></b></td><td style='padding: 8px;'>Shared domain types: <code>JobRecord</code>, <code>JobStatus</code>, <code>JobStatusResponse</code>, etc.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/state-client.ts'>state-client.ts</a></b></td><td style='padding: 8px;'>Narrow <code>StateClient</code> interface (subset of <code>@adobe/aio-lib-state</code>), injectable for tests.</td></tr>
			<tr style='border-bottom: 1px solid #eee;'><td style='padding: 8px;'><b><a href='src/ow-client.ts'>ow-client.ts</a></b></td><td style='padding: 8px;'>Narrow <code>OwClient</code> interface (subset of <code>openwhisk</code>), injectable for tests.</td></tr>
		</table>
	</blockquote>
</details>

---

## Getting Started

### Prerequisites

- **Runtime:** Node.js >= 18 (an Adobe App Builder / I/O Runtime action environment)
- **Package Manager:** npm
- **Peer dependencies:** `@adobe/aio-lib-state`, `openwhisk`, and optionally `hono` (only needed if you use `router()`) - left as peer deps so your project controls their versions.

### Installation

```sh
npm install aio-lib-jobs @adobe/aio-lib-state openwhisk hono
```

### Usage

**Submit/poll action** (`web: "raw"`, built with [Hono](https://hono.dev) via [`hono-openwhisk-adapter`](https://github.com/ahmed-musallam/hono-openwhisk-adapter)):

```ts
import { Hono } from "hono/quick";
import { bearerAuth } from "hono/bearer-auth";
import { ToOpenWhiskAction } from "hono-openwhisk-adapter";
import { init } from "aio-lib-jobs";

const jobs = await init();

const app = new Hono();
app.use("/jobs/*", bearerAuth({ token: process.env.MY_TOKEN }));
app.route("/jobs", await jobs.router("my-package/my-worker"));

export const main = ToOpenWhiskAction(app);
```

**Worker action** (non-web, plain params - runs the actual job logic):

```ts
import { runWorker } from "aio-lib-jobs";
import { init as initState } from "@adobe/aio-lib-state";

export const main = runWorker(async (ctx) => {
  // ctx.jobId, ctx.params (your business payload), ctx.isCancelled()
  if (await ctx.isCancelled()) return null;
  return { total: 42 };
}, { state: await initState() });
```

### Testing

Uses the **Vitest** test framework. Run the test suite with:

```sh
npm test
```

Run the whole verification pipeline (typecheck, tests, lint, build) with:

```sh
npx tsc --noEmit && npm test && npm run lint && npm run build
```

---

## Roadmap / Known Limitations

- [ ] Consumer-supplied prefix override (currently auto-derived from the worker action name only)
- [ ] Fan-out: a job orchestrating multiple worker invocations (currently strictly 1 job : 1 invocation)
- [ ] Pagination on `report()` (currently single-page, scoped per worker action)
- [X] Cooperative cancellation via a dedicated `.cancel` key
- [X] Read-time `stale`/`queuedMs`/`elapsedMs` computation

---

## Contributing

1. **Fork the repository** and clone your fork locally.
2. **Create a branch** with a descriptive name.
3. **Make your changes**, following the existing seams (pure logic in `src/*.ts`, tests in `test/*.test.ts` using the fakes in `test/helpers/`).
4. **Verify**: `npx tsc --noEmit && npm test && npm run lint && npm run build`.
5. **Open a pull request** describing the change and its motivation.

---

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).

<div align="right">

[![][back-to-top]](#top)

</div>

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square

---
