# Project working preferences

## Publication

Sites publication is on hold at the user's request. Do not publish or deploy current work to Sites. Keep the existing site's audience unchanged. Deliver completed checkpoints by committing and pushing `main` to GitHub; resume Sites publication only when the user requests it.

## Gameplay

Follow official Star Wars CCG rules and card text. Creativity belongs in the gameplay UI/UX. The GEMP engine determines legal actions and card effects.

The user authorized a focused Sites-native engine proof. This separate proof may execute independently, using official rules and GEMP conformance fixtures. Clearly label verified scenario coverage; keep full native starter games gated until every reachable card behavior and required timing window is verified. Preserve the existing GEMP game paths.

The current priority is full native engine implementation. Skip additional standalone Rules Lab studies; use automated conformance and integration tests to advance continuous match play while retaining the existing studies as regression coverage.

## Git checkpoints

Use `git@github.com:Westbrook/star-wars-ccg.git` as the `origin` remote. Commit completed work to `main` and push to this remote at meaningful stopping points. Preserve remote history; do not force-push.

## Progress report

Use the `progress-report` skill and reuse `.progress-report/project.json`. Read the existing handoff and unresolved feedback before continuing work. Keep the independent report current and preserve unfinished scope.
