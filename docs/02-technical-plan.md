# Technical plan

The canonical, editable technical plan lives here:

**[Pulse — Technical Plan](https://claude.ai/code/artifact/8031f0fe-9a90-49b3-a5f0-00bb74e767a9)**

It covers: decisions from the requirements answers, architecture (system diagram, editions,
check-run flow, cloud portability), data model (schema, transaction boundaries, indexes),
backend design (module layout, key interfaces, the check engine, login-flow auth, spec
parsing), the Pulse REST API, frontend pages, reports (number definitions, date rules,
generation), security/testing/CI/CD, and the sprint plan.

See [01-requirements.md](./01-requirements.md) for why this stays a pointer rather than a copy.
The rest of this `docs/` folder (architecture, data model, API reference, etc.) will be filled
in as each sprint implements the corresponding piece, cross-referencing the relevant section of
this plan rather than re-explaining it.
