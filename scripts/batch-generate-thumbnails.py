"""Generate thumbnails for all 11 missing posts via MiniMax."""
import os, urllib.request, json, base64, time

root = "/Users/friday/personal/runany"
with open(os.path.join(root, ".env")) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"): continue
        if "=" in line:
            k, _, v = line.partition("=")
            v = v.strip().strip('"').strip("'")
            if k not in os.environ: os.environ[k] = v

api_key = os.environ["MINIMAX_API_KEY"]

posts = [
    {
        "slug": "sonarly-ai-agent-auto-fixes-alerts",
        "name": "Sonarly",
        "desc": "AI Agent auto-fixes your production alerts",
        "context": "Sonarly triages alerts, finds root causes, and opens fix PRs on GitHub. 40+ integrations, 84% root-cause accuracy, YC W26.",
        "tech": "TypeScript/Next.js, AI agents, GitHub API",
    },
    {
        "slug": "kita-credit-automation-yc-w26",
        "name": "Kita",
        "desc": "VLM-Powered Credit Review Automation",
        "context": "Uses vision-language models to automate credit review for lenders in emerging markets, parsing 50+ document types from PDFs to photos. YC W26.",
        "tech": "Python, VLM, document AI, fintech",
    },
    {
        "slug": "drifting-in-space",
        "name": "Drifting in Space",
        "desc": "Server Process for Every User",
        "context": "YC W22 startup giving every web app user their own dedicated server-side process, enabling browser-based video editors and IDEs without infrastructure headaches.",
        "tech": "Rust/WebAssembly, real-time, browser infrastructure",
    },
    {
        "slug": "jibril-runtime-security",
        "name": "Jibril",
        "desc": "Runtime Security for Cloud-Native Infra",
        "context": "Uses eBPF to monitor and enforce security policies directly in the Linux kernel, protecting ephemeral cloud workloads in real time with negligible overhead.",
        "tech": "C/Rust, eBPF, Kubernetes, Linux kernel",
    },
    {
        "slug": "runtime-sandboxed-coding-agents",
        "name": "Runtime",
        "desc": "Sandboxed Coding Agents for Teams",
        "context": "Lets engineering teams deploy sandboxed coding agents (Claude Code, Codex) where non-engineers can safely ship code without risking production or secrets.",
        "tech": "Go/Rust, Docker, sandboxing, Claude Code/Codex",
    },
    {
        "slug": "ardent-postgres-sandboxes",
        "name": "Ardent",
        "desc": "Postgres Sandboxes in Seconds for Coding Agents",
        "context": "Gives coding agents production-like Postgres sandboxes instantly, so they can test SQL safely without risking your actual database. YC P26.",
        "tech": "PostgreSQL, Rust, database virtualization",
    },
    {
        "slug": "minicor-windows-rpa-automation",
        "name": "Minicor",
        "desc": "Windows Desktop RPA at Scale via MCP",
        "context": "Connects AI agents like Claude Code and Codex to Windows VMs through an MCP server, enabling scalable desktop RPA with Python workflows, VM cloning, and 2FA handling.",
        "tech": "Python, MCP protocol, Windows VM, RPA automation",
    },
    {
        "slug": "omnara-remote-coding-agents",
        "name": "Omnara",
        "desc": "Remote Claude Code and Codex From Any Device",
        "context": "A web and mobile agentic IDE that lets you run Claude Code and Codex sessions from anywhere, keeping coding agents running even when you're away from your desk.",
        "tech": "React/Node.js, WebSocket, mobile IDE",
    },
    {
        "slug": "chert-imessage-api-developer-tool",
        "name": "Chert",
        "desc": "iMessage API for Reaching People at Scale",
        "context": "Build and deploy AI agents on iMessage to reach users at scale with human-quality conversations. YC-backed infrastructure API for iMessage automation.",
        "tech": "Swift/Objective-C, iMessage, Apple infrastructure",
    },
    {
        "slug": "stage-ai-code-review-platform",
        "name": "Stage",
        "desc": "AI Code Review That Organizes PRs Like Chapters",
        "context": "Uses AI to break pull requests into logical chapters, so reviewers understand changes faster instead of staring at a giant unorganized diff.",
        "tech": "Python/TypeScript, LLMs, GitHub API, PR review",
    },
    {
        "slug": "didit-identity-verification-platform",
        "name": "Didit",
        "desc": "Unified Identity API Replacing Five Providers in One",
        "context": "Consolidates KYC, AML, biometrics, authentication, and fraud prevention into a single API — no more stitching together five providers for global identity.",
        "tech": "Python/Go, biometrics, KYC/AML, API infrastructure",
    },
]

for i, post in enumerate(posts):
    print(f"[{i+1}/{len(posts)}] Generating: {post['slug']}...")
    
    prompt = (
        "Create a 16:9 tech blog hero thumbnail for runany.dev. "
        f"Topic: {post['name']} – {post['desc']}. "
        f"Context: {post['context']} "
        f"Visual cues: {post['tech']}. "
        "Style: futuristic developer workstation, multi-agent AI orchestration, abstract config panels without readable characters, connected nodes, subtle tooling references. "
        "Color palette: dark navy (#0a0f1a), cyan (#00d4ff), electric blue (#0066ff), emerald (#00ff88) accents. "
        "Composition: centered browser-like window with glowing blue border, "
        "generative abstract tech patterns, clean editorial banner, strong focal object, high contrast, generous negative space for title overlay. "
        "Strict: NO text, NO letters, NO numbers, NO words, NO logos, NO UI labels, NO code glyphs, NO captions, NO fake font rendering anywhere in the image."
    )

    payload = json.dumps({
        "model": "image-01",
        "prompt": prompt,
        "response_format": "base64",
        "n": 1,
        "aspect_ratio": "16:9",
        "prompt_optimizer": True
    })

    req = urllib.request.Request(
        "https://api.minimax.io/v1/image_generation",
        data=payload.encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode("utf-8"))
        b64 = data["data"]["image_base64"][0]
        path = f"/tmp/thumb_{post['slug']}.png"
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64))
        print(f"  -> OK: {path} ({len(base64.b64decode(b64))} bytes)")
    except Exception as e:
        print(f"  -> FAIL: {e}")
    
    if i < len(posts) - 1:
        time.sleep(2)

print("\nAll done!")
