/* ==========================================================================
   ticktickclock.com site build.

   The landing page is GENERATED from records/surface.json and from the
   specification itself. Every count, operation name, phase id and section
   number that reaches the page is RE-DERIVED here by reading
   docs/spec/README.md and records/contracts/*.contract.json from disk. If a
   re-derived value disagrees with the frozen record in
   records/spec-facts.json, this build throws and nothing is emitted.

   The direction of dependency is the whole point (SHELL.md §4.1). The page
   cell is COMPUTED; the record is what it is CHECKED AGAINST. If the page
   were the source, nothing could audit it — which is exactly how this page
   came to publish three of the specification's performance TARGETS as though
   they were readings.

   Run it through the gate, never on its own:   npm run test:launch
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync } from "fs";
import { createHash } from "crypto";

const read = (p) => readFileSync(p, "utf8");
const J = (p) => JSON.parse(read(p));
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

const surface = J("./records/surface.json");
const pkg = J("./package.json");
const SPEC = "./" + surface.spec_file;
const CONTRACT_DIR = "./records/contracts";
/* The upstream copies. Present when this repository sits inside the portfolio
   tree, absent in a standalone clone — so the vendored copies are what the
   page is built from, and the upstream is what they are PROVEN AGAINST when
   it is reachable. A build that cannot see upstream says so rather than
   quietly claiming it checked. */
const UPSTREAM = "../AmpersandBoxDesign/contracts/v0.1.0";
const PULSE_MANIFESTS = "../PULSE/manifests";
const RUNGS = ["spec", "in_tree", "live_local", "live_deployed", "external"];

if (pkg.version !== surface.version) {
    throw new Error(`release identity: package.json ${pkg.version} != records/surface.json ${surface.version}`);
}
const STAMP = `TICKTICKCLOCK v${surface.version} · RECORDS ${surface.verified_at}`;

const esc = (s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Observations of the environment this build ran in, recorded in
   records/build.json rather than frozen: they are legitimately different in a
   standalone clone, and a frozen fact the environment can move is a gate that
   refuses everything, which proves nothing. */
const env = {};

/* ==========================================================================
   1. READ THE SPECIFICATION AND COUNT IT

   Fenced code blocks are stripped BEFORE headings are extracted. A markdown
   heading inside a fence is not a heading, and reading one as a section has
   already cost a lane in this portfolio.
   ========================================================================== */
const specRaw = read(SPEC);
const specMd = specRaw.replace(/^```[\s\S]*?^```/gm, "");

const headings = [...specMd.matchAll(/^(#{1,6})\s+(\d+(?:\.\d+)*)\.?\s+(.*)$/gm)]
    .map((m) => ({ depth: m[1].length, num: m[2], title: m[3].trim() }));
const headingNums = headings.map((h) => h.num);
const duplicateNums = [...new Set(headingNums.filter((n) => headingNums.filter((x) => x === n).length > 1))].sort();

const facts = {
    spec_lines: specRaw.replace(/\n$/, "").split("\n").length,
    spec_bytes: Buffer.byteLength(specRaw),
    headings: headings.length,
    sections: headingNums.filter((n) => !n.includes(".")).length,
    duplicate_section_numbers: duplicateNums,
    boxes_unticked: (specRaw.match(/^\s*- \[ \]/gm) || []).length,
    boxes_ticked: (specRaw.match(/^\s*- \[x\]/gmi) || []).length,
    feasibility_ids: [...specRaw.matchAll(/\*\*(FV-\d+):/g)].map((m) => m[1]),
    acceptance_criteria: (specRaw.match(/^- Given /gm) || []).length,
    roadmap_phases: [...specMd.matchAll(/^###\s+(Pre-Phase|Phase \d+)/gm)].map((m) => m[1]),
    adrs: [...specMd.matchAll(/^###\s+(ADR-\d+)/gm)].map((m) => m[1]),
    mcp_tools: [],
    performance_targets: 0,
    rfc_keywords: (specRaw.match(/\b(MUST|SHOULD|MAY)\b/g) || []).length,
};

/* The Pre-Phase says "the three highest-risk technical assumptions" and then
   lists FV-1 … FV-4. Extract the word rather than asserting the mismatch, so
   that a corrected spec quietly stops the page saying it. */
const claimed = /validate the (\w+) highest-risk/.exec(specRaw);
facts.feasibility_claimed_word = claimed ? claimed[1] : null;

/* §8 names the MCP tools, across four subsections. Every slice below is
   bounded at the NEXT heading of any depth — an earlier version of this
   extractor stopped only at `###` and swallowed a table three sections later,
   silently inventing five operations that do not exist. Bound your slices. */
{
    const m = /^## 8\. MCP Tools\s*$([\s\S]*?)(?=^### 8\.5)/m.exec(specMd);
    if (!m) throw new Error("BUILD REFUSED — §8 MCP Tools is not in the spec any more; the page cites it.");
    facts.mcp_tools = [...new Set([...m[1].matchAll(/^\|\s*`(\w+)`\s*\|/gm)].map((x) => x[1]))].sort();
}

/* §10 is a table of TARGETS. Counting its rows is the point: this page used
   to print three of them as statistics, so the number of rows and the number
   of them with a witness are both published, and the second is zero. */
const PERF = (() => {
    const m = /^## 10\. Performance Targets\s*$([\s\S]*?)(?=^#{1,6}\s)/m.exec(specMd);
    if (!m) throw new Error("BUILD REFUSED — §10 Performance Targets has moved; the page cites it.");
    const rows = [...m[1].matchAll(/^\|\s*([^|-][^|]*?)\s*\|\s*([^|]+?)\s*\|\s*$/gm)]
        .map((x) => ({ metric: x[1], target: x[2] }))
        .filter((r) => r.metric !== "Metric");
    return rows;
})();
facts.performance_targets = PERF.length;

/* ==========================================================================
   2. THE CONTRACTS, DECLARED TWICE — SO COMPARE THEM
   ========================================================================== */
function specOperations(section) {
    const out = {};
    for (const m of specMd.matchAll(
        new RegExp(`^###\\s+${section}\\.\\d+\\s+\`(&[\\w.]+)\`\\s*$([\\s\\S]*?)(?=^#{1,6}\\s|$(?![\\s\\S]))`, "gm")
    )) {
        out[m[1]] = [...m[2].matchAll(/^\|\s*`(\w+)`\s*\|/gm)].map((x) => x[1]);
    }
    return out;
}
const specOps = specOperations("6");
const drift = [];
const contracts = [];
const contractFiles = readdirSync(CONTRACT_DIR).filter((f) => f.endsWith(".contract.json")).sort();
let upstreamChecked = 0;
for (const f of contractFiles) {
    const bytes = readFileSync(`${CONTRACT_DIR}/${f}`);
    const c = JSON.parse(bytes.toString("utf8"));
    const ops = Object.keys(c.operations);
    const fromSpec = specOps[c.capability];
    if (!fromSpec) drift.push(`${c.capability}: declared in ${f} and nowhere in §6 of the spec`);
    else {
        const missing = fromSpec.filter((o) => !ops.includes(o));
        const extra = ops.filter((o) => !fromSpec.includes(o));
        if (missing.length) drift.push(`${c.capability}: §6 declares ${missing.join(", ")}, the contract does not`);
        if (extra.length) drift.push(`${c.capability}: the contract declares ${extra.join(", ")}, §6 does not`);
    }
    if (c.provider !== "ticktickclock") drift.push(`${f}: provider is ${c.provider}, not ticktickclock`);
    if (existsSync(`${UPSTREAM}/${f}`)) {
        upstreamChecked++;
        if (sha(readFileSync(`${UPSTREAM}/${f}`)) !== sha(bytes)) {
            drift.push(`${f}: the vendored copy is not byte-identical to ${UPSTREAM}/${f}`);
        }
    }
    contracts.push({
        file: f, capability: c.capability, description: c.description,
        operations: ops.map((o) => ({ name: o, in: c.operations[o].in, out: c.operations[o].out })),
    });
}
for (const cap of Object.keys(specOps)) {
    if (!contracts.some((c) => c.capability === cap)) drift.push(`${cap}: in §6 of the spec, with no contract file`);
}
facts.contract_operations = contracts.reduce((n, c) => n + c.operations.length, 0);
facts.contract_files = contracts.length;
env.upstream_contracts_checked = upstreamChecked;

/* ==========================================================================
   3. THE PULSE LOOP, WHICH IS PROSE AND NOT A FILE

   This is the surface that corresponds to PULSE most directly, and it is the
   one with no manifest file. Worth saying out loud rather than leaving as an
   absence nobody notices.
   ========================================================================== */
const PULSE = (() => {
    const m = /^## 7\.1 PULSE Loop Manifest([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(specRaw);
    if (!m) throw new Error("BUILD REFUSED — the PULSE loop manifest section has moved; the page cites §7.1.");
    const body = m[1];
    return {
        loop_id: /\*\*Loop ID:\*\*\s*`([^`]+)`/.exec(body)[1],
        cadence: (/\*\*Cadence:\*\*\s*(.+)/.exec(body) || [, ""])[1].replace(/[`*]/g, "").trim(),
        closure: (/\*\*Closure:\*\*\s*(.+)/.exec(body) || [, ""])[1].replace(/[`*]/g, "").trim(),
        /* Backticks are Markdown, not content: the phase descriptions carry
           `feedback_immutability` and it renders as a literal grave accent on
           a page that has no code formatting inside a table cell. */
        phases: [...body.matchAll(/^\|\s*`(\w+)`\s*\|\s*`(\w+)`\s*\|\s*([^|]+?)\s*\|/gm)]
            .map((x) => ({ id: x[1], kind: x[2], what: x[3].replace(/`/g, "") })),
    };
})();
facts.pulse_loop_id = PULSE.loop_id;
facts.pulse_phases = PULSE.phases.map((p) => ({ id: p.id, kind: p.kind }));
env.pulse_manifest_files = existsSync(PULSE_MANIFESTS)
    ? readdirSync(PULSE_MANIFESTS).filter((f) => f.includes("ticktickclock")).length
    : null;

/* ==========================================================================
   4. AND THE COUNT THAT MATTERS MOST: HOW MUCH CODE IS HERE
   ========================================================================== */
function countCode(dir) {
    let n = 0;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith(".") || e.name.startsWith("old_scrap") || e.name === "node_modules") continue;
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) n += countCode(p);
        else if (/\.(ex|exs)$/.test(e.name)) n += read(p).split("\n").length;
    }
    return n;
}
facts.implementation_lines = countCode(".");

/* ==========================================================================
   5. FREEZE, THEN CHECK FOREVER AFTER
   ========================================================================== */
const FROZEN = "./records/spec-facts.json";
if (existsSync(FROZEN)) {
    const frozen = J(FROZEN);
    for (const k of Object.keys(frozen.facts)) {
        const a = JSON.stringify(frozen.facts[k]), b = JSON.stringify(facts[k]);
        if (a !== b) drift.push(`${k}: built ${b} != record ${a}`);
    }
    for (const k of Object.keys(facts)) {
        if (!(k in frozen.facts)) drift.push(`${k}: computed by this build and absent from the record`);
    }
} else {
    writeFileSync(FROZEN, JSON.stringify({
        schema: "ticktickclock-spec-facts-v1",
        _comment: "Frozen by build-site.mjs on first run. Every value here is re-derived from docs/spec/README.md and records/contracts/ on every subsequent build, and the build refuses on any disagreement. Do not hand-edit: if the specification changes, that is a spec event and the record moves with a human looking at it.",
        source: surface.spec_file,
        frozen_at: surface.verified_at,
        facts,
    }, null, 2) + "\n");
    console.log(`froze ${Object.keys(facts).length} derived facts into ${FROZEN}`);
}

if (drift.length) {
    console.error("BUILD REFUSED — the specification, the contracts and the frozen records disagree:");
    drift.forEach((d) => console.error("  " + d));
    process.exit(1);
}
console.log(`consistency gate: ${facts.spec_lines} spec lines recounted, ${facts.contract_operations} contract operations matched against §6, ${facts.performance_targets} performance targets counted, ${upstreamChecked}/${contracts.length} contracts proven against upstream, 0 drift`);

/* ==========================================================================
   SHELL FRAGMENTS
   ========================================================================== */
function rung(value) {
    const r = RUNGS.includes(value) ? value : "?";
    return `<span class="rung" data-rung="${r}" title="spec · in_tree · live_local · live_deployed · external">${r}</span>`;
}

/* The band states where you are, and WHAT IT MAY STATE DEPENDS ON THE PLACE.
   ampersand-nav/src/amp-nav.js records ticktickclock as place:3, and its own
   renderPlacement() emits THREE variants: place 2 gets the layer sentence,
   place 3 gets "a specification in the ComputeDriven world" plus a link to
   the spec, place 4 gets attribution only. Writing the layer sentence here
   would put this band in direct contradiction with the nav — the gpscoord
   tier-4 defect one rung up, and two lanes have now shipped it. */
function band() {
    const where = {
        4: `A <b>${esc(surface.parent)}</b> project`,
        3: `${esc(surface.surface)} &mdash; a <b>specification</b> in the ${esc(surface.parent)} world`,
        2: `${esc(surface.surface)} is the <b>${esc(surface.layer)}</b> layer of ${esc(surface.parent)}`,
    }[surface.tier];
    if (!where) throw new Error("BUILD REFUSED — records/surface.json declares no usable place, so the band cannot know what it may claim.");
    const link = surface.tier === 3
        ? `<a class="specref" href="${surface.spec_url}">read the spec &rarr;</a>` : "";
    return `<div class="band" data-tier="${surface.tier}"><span class="where">${where}</span>${rung(surface.surface_rung)}${link}<span class="covers">That rung covers ${esc(surface.surface_rung_covers)}.</span></div>`;
}

/* THE SHARED PORTFOLIO NAV. Ruled by Travis 2026-08-17 — "the ampersand-nav
   needs to be on each website!" — after this surface and four siblings each
   dropped it independently on adopting the shell.

   Emitted from the record rather than typed into the template, so the property
   key has one home. An unknown key is the dangerous failure: amp-nav renders
   an EMPTY bar for a property it does not know, which looks like a styling
   problem and not like a wrong string, so the build refuses it here instead.

   The vendored ./amp-nav.js is written by ampersand-nav/sync-nav.sh and is NOT
   this repo's to edit. It has been present and unreferenced all along. */
function navChrome() {
    const key = surface.nav_property;
    if (!key) throw new Error("BUILD REFUSED — records/surface.json declares no nav_property, so the page cannot say which property the shared nav should render.");
    if (!existsSync("./amp-nav.js")) throw new Error("BUILD REFUSED — ./amp-nav.js is not in this tree; the page would load the nav from a 404. Run ampersand-nav/sync-nav.sh.");
    const vendored = read("./amp-nav.js");
    if (!new RegExp(`^\\s*${key}:\\s*\\{`, "m").test(vendored)) {
        throw new Error(`BUILD REFUSED — the vendored amp-nav.js has no "${key}" property. An unknown key renders an empty nav bar rather than an error.`);
    }
    /* OBSERVED, not fingerprinted as a build INPUT. sync-nav.sh rewrites this
       file across ~21 repos and lane N runs it last; making it an input would
       make all five of these gates refuse "stale artifact" the moment lane N
       syncs, for a file this repo may not edit. Recording the hash keeps the
       revision retrievable without arming a trap for another lane. */
    env.amp_nav_sha256 = sha(Buffer.from(vendored, "utf8"));
    env.amp_nav_bytes = Buffer.byteLength(vendored);
    env.amp_nav_has_renderPlacement = /renderPlacement/.test(vendored);
    return `<script type="module" src="/amp-nav.js"></script>\n<amp-nav property="${key}"></amp-nav>`;
}

function statusBlock() {
    const s = surface.status;
    return `<dl class="status">
<div><dt>Status</dt><dd><strong>${esc(surface.surface_rung)}</strong> &mdash; ${esc(s.statement)}</dd></div>
<div><dt>Last verified</dt><dd>${esc(surface.verified_at)}</dd></div>
<div><dt>Source</dt><dd>${esc(s.source)}</dd></div>
<div class="limit"><dt>Limit</dt><dd>${esc(s.limit)}</dd></div>
<div><dt>Next rung</dt><dd><strong>${esc(surface.advance.next_rung)}</strong> &mdash; ${esc(surface.advance.requires)}</dd></div>
</dl>`;
}

/* §0.7: the rung gates the call to action. */
const VERBS = {
    spec: ["Read", "Challenge", "Implement"],
    in_tree: ["Inspect the source", "Run the tests"],
    live_local: ["Use it", "Reproduce it locally"],
    live_deployed: ["Use the deployed artifact"],
    external: ["See independent evidence", "Contribute another result"],
};
function cta(groupRung, label, actions) {
    const allowed = VERBS[groupRung];
    if (!allowed) throw new Error(`CTA group declares an unknown rung: ${groupRung}`);
    for (const a of actions) {
        if (!allowed.includes(a.verb)) {
            throw new Error(`BUILD REFUSED — CTA "${a.verb}" is not available at rung ${groupRung}. Allowed: ${allowed.join(", ")}`);
        }
    }
    const cls = groupRung === "spec" ? "tag" : "tag ok";
    return `<div class="ctagroup"><div class="${cls}">${esc(groupRung)} &mdash; ${esc(label)}</div><div class="cta">${actions
        .map((a) => `<a href="${a.href}"${a.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}><span class="verb">${esc(a.verb)}</span><span class="what">${a.what}</span></a>`)
        .join("")}</div></div>`;
}

/* ==========================================================================
   GENERATED CONTENT

   Every figure carries its noun INSIDE its own text node. That is not a style
   choice: a bare integer as a text node collides with any literal of the same
   value in the animation source and the publication gate refuses the build.
   The honest fix for that collision is a label, never a quieter check.
   ========================================================================== */
function plate() {
    const cells = [
        [`${facts.spec_lines} lines`, "The specification, in full"],
        [`${facts.contract_operations} operations`, "Declared across three contracts"],
        [`${facts.boxes_unticked} unticked`, "Task boxes, and none ticked"],
        ...surface.zero_counts.map((z) => [`${z.value} ${z.unit}`, z.label]),
    ];
    return `<div class="grid plate">${cells
        .map(([n, l]) => `<div><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`).join("")}</div>`;
}

function loopFigure() {
    return `<div class="loop">${PULSE.phases.map((p) =>
        `<div><div class="kind">${esc(p.kind)}</div><div class="id">${esc(p.id)}</div><div class="what">${esc(p.what)}</div></div>`
    ).join("")}</div>`;
}
const CLOSURE = `<div class="closure"><b>closure</b> ${esc(PULSE.closure)}<br><b>cadence</b> ${esc(PULSE.cadence)}<br><b>manifest</b> ` +
    (env.pulse_manifest_files === null
        ? `not checked &mdash; PULSE/ is a sibling repository and was not on disk during this build, so the claim is withheld rather than guessed`
        : env.pulse_manifest_files === 0
            ? `none. There is no ${esc(PULSE.loop_id)}.pulse.json in PULSE/manifests/ &mdash; looked for during this build and not found &mdash; so nothing can be validated against pulse-loop-manifest.v0.1.json, and the loop cannot be discovered by a tool that reads manifests rather than English`
            : `a manifest file for this loop now exists in PULSE/manifests/, and the gate it was blocking in records/surface.json should be re-read`) +
    `</div>`;

const CONTRACT_LINE =
    `The same document declares three capability contracts &mdash; ` +
    contracts.map((c) => `<code>${esc(c.capability)}</code>`).join(", ") +
    ` &mdash; with ${facts.contract_operations} operations between them, typed in and out. Each is written twice, once as a table in §6 and once as JSON beside this page, and two hand-maintained copies of one list drift. This build compares them in both directions and refuses to emit anything if they differ.`;

function openCards() {
    return `<div class="grid">${surface.unmeasured
        .map((c) => `<div><div class="head"><h3>${esc(c.name)}</h3>${rung(c.rung)}</div><p>${esc(c.detail)}</p><div class="needs"><b>Needs:</b> ${esc(c.needs)} <b>Built:</b> ${esc(c.built)}.</div></div>`)
        .join("")}</div>`;
}

function factsTable() {
    const rows = [
        ["Specification, as a file", `${facts.spec_lines} lines`, `${facts.spec_bytes} bytes of Markdown, last dated 25 March 2026 inside the document itself`],
        ["Numbered headings", `${facts.headings} headings`, `${facts.sections} sections at the top level, and no number used twice. Fenced code blocks are stripped before headings are read, or an Elixir comment becomes a section`],
        ["Performance figures", `${facts.performance_targets} targets`, `Every one of them a target, and none of them a measurement: ${PERF.slice(0, 3).map((p) => p.metric.toLowerCase()).join("; ")}, and six more. Nothing has run, so nothing has been timed`],
        ["Task boxes in the roadmap", `${facts.boxes_unticked} unticked`, `${facts.boxes_ticked} ticked. This is the roadmap of a project that has not begun, counted rather than characterised`],
        ["Feasibility validations", `${facts.feasibility_ids.length} declared`, `${facts.feasibility_ids.join(", ")} — introduced by a sentence that says "${facts.feasibility_claimed_word}"`],
        ["Acceptance test criteria", `${facts.acceptance_criteria} criteria`, "Each a Given-then sentence with a latency or a bound. None has ever been run, because there is nothing to run it against"],
        ["Roadmap stages", `${facts.roadmap_phases.length} stages`, `${facts.roadmap_phases.join(", ")} — 30 weeks of them, starting from a Pre-Phase that has not started`],
        ["Architecture decisions", `${facts.adrs.length} records`, `${facts.adrs.join(", ")}. Decisions taken on paper about a system that does not exist; ADR-0005 is the one that already binds, since it rules EXLA out portfolio-wide`],
        ["MCP tools named", `${facts.mcp_tools.length} tools`, `${facts.mcp_tools.join(", ")}. Names in a table, not functions in a module`],
        ["Capability contracts", `${facts.contract_files} contracts`, `${facts.contract_operations} operations, matched in both directions against the tables in §6; ${env.upstream_contracts_checked} of them also proven byte-identical to the upstream copies during this build`],
        ["PULSE loop phases", `${facts.pulse_phases.length} phases`, `${facts.pulse_phases.map((p) => p.id).join(", ")} — every one of the five canonical PULSE kinds, declared as prose in a Markdown table with no manifest file behind it`],
        ["RFC keywords in the document", `${facts.rfc_keywords} keywords`, "No MUST, no SHOULD, no MAY. This is a design document, not a conformance specification, and nothing in it can be conformed to yet"],
        ["Implementation, in lines", `${facts.implementation_lines} lines`, "No .ex or .exs file exists in this repository outside old_scraps/, recounted on every build"],
    ];
    const artifacts = surface.artifacts.map((a) =>
        `<tr><td class="place">${esc(a.name)}</td><td class="num">${rung(a.rung)}</td><td class="note">${esc(a.where)}</td><td class="note">${esc(a.witness)}</td></tr>`).join("");
    return `<div class="scroll"><table><thead><tr><th>What was counted</th><th>Result</th><th>How, and what it does not mean</th></tr></thead><tbody>${rows
        .map(([a, b, c]) => `<tr><td class="place">${esc(a)}</td><td class="num">${esc(b)}</td><td class="note">${esc(c)}</td></tr>`)
        .join("")}${artifacts}</tbody></table></div>`;
}

const METHOD_NOTE =
    `Each row was produced by reading <code>${esc(surface.spec_file)}</code> during this build, with fenced code blocks stripped first so that Markdown inside an Elixir example cannot be counted as prose. ` +
    `Operation names were taken from the tables in §6 and compared against <code>records/contracts/*.contract.json</code> in both directions &mdash; an operation in one and not the other refuses the build, which is the only reason two hand-maintained copies of a list can be trusted to agree. ` +
    `The performance row counts §10 rather than quoting it, because quoting it is exactly what this page did wrong. ` +
    `The frozen copy of every figure lives in <code>records/spec-facts.json</code>; the build re-derives them all and exits non-zero on any disagreement, so a number on this page cannot be edited into existence.`;

function zeros() {
    return `<dl class="status">${surface.zero_counts
        .map((z) => `<div><dt>${esc(z.label)}</dt><dd><strong>${esc(z.value)}.</strong> ${esc(z.witness)}</dd></div>`).join("")}</dl>`;
}

/* ==========================================================================
   THE RETRACTION
   The four strings quoted below stood on this page until this revision and
   none had a witness. They are in launch-gate.mjs's blocklist, which COUNTS
   occurrences rather than testing for presence — so they cannot come back by
   an edit anywhere else on the page while the retraction stays put.
   ========================================================================== */
const RETRACTION = `<div class="retract"><h3>Retraction &mdash; this page printed targets as though they were readings</h3>
<p>Until this revision, four figures stood under the question at the top of this page, in the layout a dashboard uses. One was labelled <code>Sync Precision</code> and read under ten milliseconds. One was labelled <code>Temporal Forgetting</code> and read zero drift. One claimed unbounded concurrent series. The fourth was labelled <code>Ticks Observed</code> and read zero &mdash; which was the only accurate one, and it was accurate by accident, because it was not counting anything either.</p>
<p><strong>Three of those four are rows lifted out of §10, a table the specification itself titles as targets.</strong> Nothing has been compiled, so no tick has ever been ingested, no anomaly detected and no forecast made; there is no system for a latency to be a property of. The page also said <code>Every TickTickClock endpoint is an MCP</code> server, and offered a button reading <code>Discover on FleetPrompt</code> pointing at a marketplace that has never had a TickTickClock anything in it.</p>
<p>The fix is structural rather than careful. Those strings are now in the publication gate's blocklist and the gate counts their occurrences: they may appear in this paragraph and nowhere else on the page, so reinstating one refuses the build. §10 is now <em>counted</em> instead of quoted &mdash; the page publishes how many targets there are and how many have a witness, and the second number is zero. The figures come back when a measurement comes back, and not before.</p></div>`;

/* ==========================================================================
   EMIT
   ========================================================================== */
const CSS = read("./src/shell.css")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*/g, "").replace(/;\}/g, "}").trim();

/* Scripts are emitted as their own artifacts rather than inlined so the
   landing page's markup stays content-only, and so the animation becomes a
   file the publication gate can read constants out of and compare against the
   page. NEWLINES ARE KEPT — joining JavaScript lines the way the CSS is
   joined is a semicolon-insertion bug waiting to happen. */
const strip = (p) => read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/^[ \t]+/gm, "").replace(/[ \t]+$/gm, "").replace(/\n{2,}/g, "\n").trim();
const ANIM = strip("./src/phases.js");
const SAY = strip("./src/say.js");

function fill(tpl, vars) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
        if (!(k in vars)) throw new Error(`template token {{${k}}} has no value`);
        return vars[k];
    });
}

const landing = fill(read("./src/landing.html"), {
    CSS,
    BAND: band(),
    NAV: navChrome(),
    STAMP,
    ORIGIN: surface.origin,
    REPO: surface.repo,
    PARENT: esc(surface.parent),
    SPEC_URL: surface.spec_url,
    CONTACT: surface.contact.url,
    ENDPOINT: surface.contact.endpoint,
    QUESTION: esc(surface.question),
    YEAR: String(new Date(surface.verified_at).getUTCFullYear()),
    PLATE: plate(),
    LOOP: loopFigure(),
    CLOSURE,
    CONTRACT_LINE,
    OPEN_CARDS: openCards(),
    FACTS_TABLE: factsTable(),
    METHOD_NOTE,
    STATUS: statusBlock(),
    ZEROS: zeros(),
    RETRACTION,
    CTA: cta("spec", "a draft document, four unrun experiments and no implementation", [
        {
            verb: "Read",
            href: surface.spec_url,
            what: "The v0.1 draft, served in full. §12 is the section worth starting at &mdash; it is where the document says which of its own assumptions it does not yet believe.",
        },
        {
            verb: "Challenge",
            href: "#say",
            what: "A target in §10 that is not reachable on the BEAM, a consolidation scheme that drops events under load, an operation §6 types wrongly. An input and an expected value is the most useful thing anyone can send.",
        },
        {
            verb: "Implement",
            href: surface.repo,
            what: "FV-2 needs no model and no dataset: four GenServers at four intervals, events promoting between them, and a number at the end. Whoever runs it first learns whether the rest is worth writing.",
        },
    ]),
});

/* r8: hash what we are about to write, write it beside the target, read the
   bytes back off disk, re-hash, and only then rename into place. A gate that
   reads an artifact must be able to prove the artifact is THIS build's — and
   a build that throws leaves the previous index.html on disk looking perfect,
   which is exactly how two deliberate breaks reported PASS on a sibling. */
const emitted = {};
function emit(path, text) {
    const buf = Buffer.from(text, "utf8");
    const want = sha(buf);
    writeFileSync(path + ".tmp", buf);
    const back = readFileSync(path + ".tmp");
    if (sha(back) !== want) throw new Error(`BUILD REFUSED — ${path} did not survive the round trip to disk.`);
    renameSync(path + ".tmp", path);
    emitted[path.replace(/^\.\//, "")] = { sha256: want, bytes: buf.length };
    console.log(`wrote ${path.padEnd(16)} ${buf.length.toLocaleString()} bytes`);
}
emit("./index.html", landing);
emit("./phases.js", ANIM + "\n");
emit("./say.js", SAY + "\n");

/* Every input this build READ, fingerprinted. The gate recomputes these from
   disk: if any of them has moved since the last successful emit, the artifact
   beside them is stale and the gate refuses rather than approving a page that
   was generated from a source nobody can retrieve. */
const INPUTS = [
    "./package.json", "./records/surface.json", "./records/spec-facts.json",
    "./src/shell.css", "./src/landing.html", "./src/phases.js", "./src/say.js",
    SPEC, ...contractFiles.map((f) => `${CONTRACT_DIR}/${f}`),
];
const inputs = {};
for (const p of INPUTS) inputs[p.replace(/^\.\//, "")] = sha(readFileSync(p));
writeFileSync("./records/build.json", JSON.stringify({
    schema: "computedriven-build-v1",
    _comment: "Written by build-site.mjs at the end of a successful emit and read by launch-gate.mjs. `inputs` proves the artifact is not stale — a build that threw leaves a previous index.html on disk and the gate would otherwise approve it. `artifacts` proves the emitted bytes have not been hand-edited since. Both directions are needed; either alone has a hole.",
    built_at: new Date().toISOString(),
    stamp: STAMP,
    environment: env,
    inputs,
    artifacts: emitted,
}, null, 2) + "\n");
console.log(`wrote records/build.json  ${Object.keys(inputs).length} input fingerprints, ${Object.keys(emitted).length} artifact hashes`);
