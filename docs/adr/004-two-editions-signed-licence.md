# ADR-004: Cloud + Private editions, gated by a signed licence file

**Status:** Accepted (sprint 1, implementation lands sprint 8)

## Context

Requirements review established that monitored applications may live on a private network
(VPN, localhost, company LAN), and that when a company wants to run Pulse against their private
network, only the platform owner should be able to configure and grant that access — not the
customer themselves. This needs to coexist with the public multi-tenant Cloud product (ADR-003)
without either edition weakening the other's security guarantees.

## Decision

Two editions built from the same codebase, switched by an `EDITION` setting:

- **Cloud**: multi-tenant, always blocks requests to private/internal IP ranges (SSRF
  protection, technical plan section 8.1).
- **Private**: single organisation, installed inside the customer's own network. Its allow-list
  of private IP ranges it's permitted to check comes only from a licence file signed with the
  platform owner's private key; the public key is embedded in the Docker image and verifies the
  file at startup. A customer can install the package but cannot widen the allow-list or add
  organisations without a new signed file from the platform owner.

## Why

- A signed licence file is a mechanical enforcement of "only I can configure it" — it doesn't
  rely on the customer refraining from editing a config file, because an unsigned or tampered
  file simply fails verification and Pulse refuses to start with the wider allow-list.
- Keeping one codebase (rather than a forked private build) means every fix and feature lands in
  both editions automatically, and the SSRF guard, the riskiest piece of code in the whole
  system, has one implementation (`NetworkPolicy` interface, two implementations) instead of two
  codebases that can drift apart.

## Alternatives considered

- **A per-customer config flag the customer sets themselves**: rejected — this is exactly the
  self-service model the requirement explicitly ruled out ("only I should be able to configure
  it").
- **A fully separate private-edition codebase**: rejected — doubles maintenance and risks the
  SSRF guard (or any other security-critical code) diverging between editions over time.

## Consequences

- `NetworkPolicy` is an interface with two implementations
  (`CloudNetworkPolicy`, `LicensedPrivateNetworkPolicy`) — adding the Private edition later
  means writing a new implementation, not touching Cloud's.
- The platform owner needs a licence-signing CLI (sprint 8) that only they hold the private key
  for; losing that key means no new Private-edition allow-lists can ever be issued, so its
  storage and backup is itself a decision worth documenting when sprint 8 builds it.
- Every Private edition install ships the same Docker images as Cloud — there is no "Private
  edition build," only a licence file and an `EDITION` setting.
