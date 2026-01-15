#!/usr/bin/env python3
"""
Replay Gravity Courier into 900 backdated commits, spread across the *months before*
the current release window (same idea as Echo Maze’s 30×30, but the calendar span is
several preceding months instead of one contiguous 30-day block).

Commits are dated Jan→May so contribution squares fill earlier months. One final
`git push --force` is enough for GitHub to honor commit dates; use --push-each only
if you want one network round-trip per commit (slow).

Destructive: removes .git and re-inits. Run only when you intend to replace history.

  python3 scripts/bake-history.py --remote git@github.com:USER/game-gravity-courier.git
  python3 scripts/bake-history.py --remote git@github.com:USER/game-gravity-courier.git --push-each

Requires all tracked source files to exist under the repo root.
"""
from __future__ import annotations

import argparse
import os
import random
import shutil
import subprocess
import sys
import time
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOTAL_COMMITS = 900
# ~3.5 months of calendar days; commits spread evenly across this span
NUM_DAYS = 108
# First day of synthetic history (months before May 2026)
START_DAY = datetime(2026, 1, 14, 8, 40, 0)
AUTHOR_NAME = "Fitsum Mehari"
AUTHOR_EMAIL = "FitsumMehari@users.noreply.github.com"

FILE_GROUPS: list[tuple[list[str], str]] = [
    (["package.json", ".gitignore"], "chore: scaffold package and ignore rules"),
    (["tsconfig.json", "vite.config.ts"], "build: TypeScript and Vite baseline"),
    (["index.html"], "feat: HTML shell and mount point"),
    (["public/favicon.svg"], "assets: favicon"),
    (["src/constants.ts"], "feat: physics and tuning constants"),
    (["src/levelData.ts"], "feat: level platforms and spawn metadata"),
    (["src/replay.ts"], "feat: ghost replay persistence"),
    (["src/GravityGame.ts"], "feat: gravity courier core loop and rendering"),
    (["src/main.ts"], "feat: menus, HUD, input and frame loop"),
    (["src/style.css"], "style: HUD, overlays, panels"),
    (["README.md"], "docs: readme and GitHub Pages notes"),
    ([".github/workflows/pages.yml"], "ci: deploy to gh-pages"),
    (["package-lock.json", "scripts/bake-history.py"], "chore: lockfile and months-span history bake script"),
]

LOG_PREFIXES = [
    "wip:",
    "tweak:",
    "polish:",
    "debug:",
    "test:",
    "note:",
    "refactor:",
    "perf:",
    "ui:",
    "balance:",
    "playtest:",
]

LOG_TOPICS = [
    "ground probe vs tilted up",
    "camera view axis vs WASD",
    "strafe handedness fix",
    "coyote jump window",
    "package stress jolt curve",
    "ghost playback smoothing",
    "pointer lock + pause",
    "delivery ring visibility",
    "gravity lock roof tint",
    "spawn slab ray resolve",
    "fall reset depth",
    "movement basis pitch project",
    "pickup bob along worldUp",
    "stress bar HUD timing",
    "level half extents collision",
    "click gravity ray pick",
    "replay localStorage key",
    "Pages workflow branch",
    "ACES tone map exposure",
    "third-person camera distance",
]


def git_env(dt: datetime) -> dict[str, str]:
    ds = dt.strftime("%Y-%m-%d %H:%M:%S")
    e = os.environ.copy()
    e["GIT_AUTHOR_DATE"] = ds
    e["GIT_COMMITTER_DATE"] = ds
    return e


def run_git(args: list[str], dt: datetime | None = None) -> None:
    env = git_env(dt) if dt else os.environ.copy()
    env.setdefault("GIT_AUTHOR_NAME", AUTHOR_NAME)
    env.setdefault("GIT_AUTHOR_EMAIL", AUTHOR_EMAIL)
    subprocess.run(
        ["git", "-c", f"user.name={AUTHOR_NAME}", "-c", f"user.email={AUTHOR_EMAIL}", *args],
        cwd=ROOT,
        env=env,
        check=True,
    )


def commit_day_index(k: int) -> int:
    """Spread commit k across NUM_DAYS (0 .. NUM_DAYS-1)."""
    return min(NUM_DAYS - 1, (k * NUM_DAYS) // TOTAL_COMMITS)


def commit_time(day_index: int, slot: int) -> datetime:
    """Human-ish spread within the day."""
    base = START_DAY + timedelta(days=day_index)
    rng = random.Random(day_index * 1000 + slot + 17)
    hour = rng.choice([9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22])
    minute = rng.randint(0, 59)
    second = rng.randint(0, 59)
    return base.replace(hour=hour, minute=minute, second=second)


def log_message(index: int) -> str:
    rng = random.Random(index + 808)
    p = rng.choice(LOG_PREFIXES)
    t = rng.choice(LOG_TOPICS)
    return f"{p} {t}"


def append_session_line(path: str, line: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.isfile(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("# Session log\n\n")
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"- {line}\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bake 900 Gravity Courier commits across prior months; optional push.",
    )
    parser.add_argument(
        "--remote",
        type=str,
        default=None,
        metavar="URL",
        help="Git remote URL for origin (required before push).",
    )
    parser.add_argument(
        "--push-each",
        action="store_true",
        help="Push after every commit (~900 round trips). Slow; not needed for contribution dates.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.08,
        metavar="SEC",
        help="Sleep between pushes when using --push-each.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print plan only; do not touch .git.",
    )
    args = parser.parse_args()

    assert len(FILE_GROUPS) == 13

    os.chdir(ROOT)
    random.seed(43)

    if args.dry_run:
        print(f"Would create {TOTAL_COMMITS} commits over {NUM_DAYS} days from {START_DAY.date()}.")
        return 0

    git_dir = os.path.join(ROOT, ".git")
    if os.path.isdir(git_dir):
        shutil.rmtree(git_dir)

    subprocess.run(["git", "init", "-b", "main"], cwd=ROOT, check=True)

    if args.remote:
        subprocess.run(["git", "remote", "add", "origin", args.remote], cwd=ROOT, check=True)

    prev_day = -1
    slot = 0

    for k in range(TOTAL_COMMITS):
        day = commit_day_index(k)
        if day != prev_day:
            prev_day = day
            slot = 0
        else:
            slot += 1
        dt = commit_time(day, slot)

        if k < len(FILE_GROUPS):
            paths, msg = FILE_GROUPS[k]
            missing = [p for p in paths if not os.path.isfile(os.path.join(ROOT, p))]
            if missing:
                print(f"Missing files for batch {k}: {missing}", file=sys.stderr)
                return 1
            run_git(["add", "--"] + paths, dt)
            run_git(["commit", "-m", msg], dt)
        else:
            line = f"{log_message(k)} (day {day + 1})"
            log_path = os.path.join(ROOT, "docs", "session-log.md")
            append_session_line(log_path, line)
            run_git(["add", "docs/session-log.md"], dt)
            run_git(["commit", "-m", log_message(k)], dt)

        if args.push_each and args.remote:
            if args.delay > 0:
                time.sleep(args.delay)
            if k == 0:
                subprocess.run(["git", "push", "-u", "origin", "main"], cwd=ROOT, check=True)
            else:
                subprocess.run(["git", "push"], cwd=ROOT, check=True)

    print(f"Done: {TOTAL_COMMITS} commits on main spanning ~{NUM_DAYS} days from {START_DAY.date()}.")

    if args.remote and not args.push_each:
        subprocess.run(["git", "push", "--force", "origin", "main"], cwd=ROOT, check=True)
        print("Force-pushed to origin/main (history rewritten).")

    if args.push_each:
        print(f"(Used {TOTAL_COMMITS} incremental pushes.)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
