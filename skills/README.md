# skills/

Repo-level (master) skills directory. Anything here is symlinked under
`.claude/skills/` so it's available to any agent working on any project in
this repo, not just one subfolder.

## ego-browser

Vendored from [citrolabs/ego-lite](https://github.com/citrolabs/ego-lite)
(MIT license, see `ego-browser/LICENSE-ego-lite`). Gives agents a CLI-driven
browser (open pages, click, fill forms, screenshot, scrape) via the
`ego-browser` command.

The skill package here (`SKILL.md`, `references/`, `scripts/install.sh`) is
just the agent-facing wrapper. The actual `ego-browser` binary ships inside
the closed-source **ego lite** desktop app, which is **macOS-only** and
requires a one-time GUI onboarding step by a human
(`skills/ego-browser/scripts/install.sh`, or https://lite.ego.app/).

It could not be installed in this session because this container runs
Linux, not macOS. To finish setup: on a Mac, run
`sh skills/ego-browser/scripts/install.sh` (or download from the site
above), complete onboarding, then any agent working in this repo can use
the `ego-browser` skill.
