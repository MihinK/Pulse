# Pulse documentation

This folder is the source of truth for how Pulse works and why it's built the way it is.
Update the relevant page in the same PR that changes the behaviour it describes.

| Doc                                                                    | Contents                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [01-requirements.md](./01-requirements.md)                             | Product requirements: goals, scope, functional and non-functional requirements  |
| [02-technical-plan.md](./02-technical-plan.md)                         | Architecture, data model, API, frontend, reports, testing, sprint plan          |
| [03-architecture.md](./03-architecture.md)                             | System diagram, modules, data flow (summary; full detail in the technical plan) |
| [04-data-model.md](./04-data-model.md)                                 | Database schema, transaction boundaries, indexes                                |
| [05-api-reference.md](./05-api-reference.md)                           | Pulse's own REST API — links to the generated Swagger UI                        |
| [06-reports-numbers-and-dates.md](./06-reports-numbers-and-dates.md)   | Exact definitions of every report number and the date/time zone rules           |
| [07-security.md](./07-security.md)                                     | SSRF protection, secret encryption, auth, multi-tenancy isolation               |
| [08-testing.md](./08-testing.md)                                       | Test levels, how to run them, the coverage gate                                 |
| [09-deployment-cloud.md](./09-deployment-cloud.md)                     | CI/CD pipeline, Docker images, Cloud edition deployment                         |
| [10-deployment-private-edition.md](./10-deployment-private-edition.md) | Private edition install, licence file signing                                   |
| [features/](./features/)                                               | One page per feature                                                            |
| [adr/](./adr/)                                                         | Architecture Decision Records                                                   |

See the repository root [README.md](../README.md) for local setup instructions.
