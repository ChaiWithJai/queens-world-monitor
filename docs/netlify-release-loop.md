# GitHub → Netlify release loop

Queens World Monitor uses native Netlify Git deployments and a separate GitHub
verification check. Netlify owns environment URLs; GitHub CI proves that the
same locked source can produce the standalone artifact.

## Environments

| Environment | Git source | Netlify context | Purpose |
| --- | --- | --- | --- |
| Deploy preview | Pull request into `staging` or `main` | `deploy-preview` | Review at `deploy-preview-<PR>--queens-world-monitor.netlify.app`. |
| Staging | `staging` branch | `branch-deploy` / `staging` | Stable acceptance at `staging--queens-world-monitor.netlify.app`. |
| Production | `main` branch | `production` | Public release at `queens-world-monitor.netlify.app`. |

Promotion is merge-based: feature branch → PR → `staging` → acceptance → PR →
`main`. Do not deploy a local dirty worktree to production. Netlify deploy IDs
remain the rollback units if a release must be restored.

## Release gates

### Acceptance / E2E

- Open the deploy URL and confirm the monitor title and map render.
- Search a person such as Ralph Bunche and open the matching dossier.
- Check Coverage mode and the Queens Calendar link at desktop and 390px mobile.

### Integration

- `npm run check:queens-build` verifies that `/` and `/queens.html` ship the
  same entrypoint, hashed assets exist, and inherited upstream applications are
  absent from the published directory.
- Netlify must redirect `/queens.html` to `/` and serve immutable cache headers
  only for hashed assets.

### Unit / data flow

- `npm run test:queens` checks stories, people, coverage IDs, world links, and
  the Queens Calendar snapshot.
- `npm run typecheck` checks the TypeScript graph used by the build.

The complete local/CI release gate is `npm run ci:queens`.

## Common failure modes and mitigations

1. **Wrong build command or publish directory.** The inherited project’s
   default build is not this product. `netlify.toml` pins `npm run ci:queens`
   and `dist-queens` for every context.
2. **Inherited postinstall work.** The upstream package installs a separate blog
   during `postinstall`. Netlify and GitHub use `npm ci --ignore-scripts`; the
   Queens build does not require that unrelated step.
3. **Inherited GitHub workflows.** Worker, Convex, package-publishing, scheduled,
   and desktop workflows were removed before the first push so this repository
   cannot request unrelated secrets or deploy upstream services.
4. **Inherited dependency automation.** The upstream Dependabot configuration
   targeted Docker images and subprojects this site does not deploy. It was
   removed to prevent unrelated update jobs and preview builds; dependency
   updates remain deliberate until the Queens package surface is separated.
5. **Production branch drift.** Netlify production must remain `main`; staging
   must be an explicit branch deploy. Never point the production site at
   `staging` to test a release.
6. **Preview/prod configuration drift.** All Netlify contexts execute the same
   release gate. Context blocks may add environment values later, but must not
   substitute a different build command.
7. **Stale HTML with fresh hashed assets.** HTML revalidates on every request;
   only fingerprinted `/assets/*` files receive immutable caching.
8. **Publishing the source root.** The integration check rejects inherited API,
   server, blog, or worker paths in the deploy artifact.
9. **Manual production deploys bypassing Git.** Normal releases come from merges
   to `main`. A CLI deploy is for diagnosis only unless an incident explicitly
   requires a documented rollback.
10. **Calendar snapshot assumptions.** The deployed event data is the committed
   snapshot. Refresh it with `npm run sync:queens-calendar`, review the diff, and
   promote it through the same preview → staging → production loop.

## Operator checklist

1. Start from updated `staging`; create a short-lived feature branch.
2. Run `npm run ci:queens` locally.
3. Push and review both GitHub CI and the Netlify deploy preview.
4. Merge into `staging`; perform acceptance checks on the stable staging URL.
5. Open a `staging` → `main` pull request and require the same checks.
6. Merge to publish production; verify `/`, one search journey, Calendar, and
   mobile layout.
7. Record the production commit and Netlify deploy permalink in release notes.
