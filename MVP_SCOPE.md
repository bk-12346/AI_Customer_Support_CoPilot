# SupportAI — MVP Scope Document

> **Last Updated:** January 2025  
> **Status:** Active  
> **Version:** 1.0

---

## Product Overview

**Product Name:** SupportAI

**One-liner:** A platform-agnostic AI co-pilot that helps customer support agents respond faster and more accurately.

**MVP Goal:** Deliver a working product that connects to Zendesk, generates AI-drafted responses using RAG, and allows agents to review, edit, and send replies — sufficient to onboard 1–3 pilot customers in the UAE.

---

## Target Users (MVP)

| User Type | Description |
|-----------|-------------|
| Primary | Customer support agents using Zendesk |
| Secondary | Support team leads/managers who configure the tool |
| Buyer | Operations or CX leadership at SMBs (10–50 agents) |

**Target Customer Profile:**
- UAE/GCC-based companies
- Using Zendesk Suite (Team, Growth, or Professional)
- English-primary support
- E-commerce, SaaS, or Tech Services
- Frustrated with response times or consistency

---

## Core Features (In Scope)

### 1. Zendesk Integration
- OAuth connection to customer's Zendesk account
- Sync tickets (new, updated, commented)
- Sync Help Center articles as knowledge base
- Save AI drafts as internal notes (not auto-send)
- Webhook support for real-time ticket events

### 2. AI Draft Generation
- RAG-based response generation using OpenAI
- Retrieves context from KB articles and similar past tickets
- Returns draft with confidence score
- Shows sources used for transparency
- Fallback message when confidence is low

### 3. Guardrails & Safety
- PII detection and redaction before LLM calls
- Input sanitization and validation
- OpenAI moderation check on outputs
- Rate limiting on all endpoints

### 4. Agent Dashboard
- Login/signup with email
- Onboarding wizard to connect Zendesk
- Ticket list view (synced from Zendesk)
- Ticket detail view with conversation thread
- AI draft panel with edit capability
- Approve/send or reject/regenerate actions
- Basic settings page

### 5. Knowledge Management
- Ingest Zendesk Help Center articles
- Manual upload of additional documents (text/PDF)
- Embed and index for RAG retrieval
- Display which sources contributed to response

### 6. Security & Compliance
- Supabase Row-Level Security for tenant isolation
- Encrypted credentials storage
- Audit logging (who approved what, when)
- Role-based access (Admin vs Agent)
- Data retention controls (configurable)

### 7. Infrastructure
- Background job processing for webhooks
- Async embedding generation
- Error tracking (Sentry)
- Structured logging (no raw PII)

---

## Out of Scope (MVP)

| Feature | Reason | Target Phase |
|---------|--------|--------------|
| Multi-platform support (Freshdesk, Salesforce, Intercom) | Focus on Zendesk first | Post-MVP |
| Arabic language support | English-first for MVP | Post-MVP |
| Auto-send responses | Too risky without trust established | Post-MVP |
| Auto-tagging/triage | Nice-to-have, not core | Post-MVP |
| Learning from approved replies | Requires more data | Post-MVP |
| Manager analytics dashboard | Focus on agent experience first | Post-MVP |
| CSAT integration | Dependent on customer data | Post-MVP |
| Custom branding/white-label | Enterprise feature | Post-MVP |
| Mobile app | Web-first | Post-MVP |
| Billing/payments | Free pilot first | Post-MVP |
| Multi-language support | English only for MVP | Post-MVP |
| Voice/phone support | Text-based only | Future |
| Slack/Teams integration | Zendesk only | Post-MVP |
| On-premise deployment | Cloud only | Future |
| SSO/SAML | Email auth for MVP | Post-MVP |

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Draft acceptance rate | 70–80% | Approved with minor/no edits vs total drafts |
| Time to first response | 30%+ reduction | Compare before/after for pilot customers |
| Agent adoption | >50% of agents using daily | Active users / total users |
| System uptime | >99% | Monitoring alerts |
| Pilot customers onboarded | 1–3 | Signed agreements, active usage |

---

## Technical Constraints

| Constraint | Decision |
|------------|----------|
| LLM Provider | OpenAI (GPT-4o or GPT-4-turbo) |
| Hosting | Vercel (app) + Supabase (DB, auth, storage) |
| Vector Store | Supabase pgvector (Pinecone as scale path) |
| Primary Platform | Zendesk only |
| Language | English only |
| Auth | Supabase Auth (email/password) |
| Background Jobs | Supabase Edge Functions or lightweight worker |

---

## Assumptions

| Assumption | Impact if Wrong |
|------------|-----------------|
| Pilot customers have Zendesk | Need to find different pilots or add another platform |
| English-primary support is sufficient for UAE B2B | May limit addressable market |
| Agents will review drafts before sending | Core UX assumption; auto-send not in scope |
| RAG with KB + tickets provides sufficient context | May need additional data sources |
| OpenAI quality is good enough | May need prompt tuning or model switch |
| Supabase scales for MVP load | May need to optimize or migrate earlier |

---

## Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Zendesk API access | Medium | Test with sandbox early; have backup test account |
| OpenAI API availability | Low | Monitor status; implement retry logic |
| Supabase uptime | Low | Standard SLA should suffice for MVP |
| Pilot customer availability | High | Start outreach by Sprint 4 |

---

## Timeline

| Milestone | Target Date |
|-----------|-------------|
| Sprint 1 complete (Foundation + Data) | End of Week 1 |
| Sprint 2 complete (Core AI) | End of Week 2 |
| Sprint 3 complete (Zendesk Integration) | End of Week 3 |
| Sprint 4 complete (Dashboard UI) | End of Week 4 |
| Sprint 5 complete (Security + Infra) | End of Week 5 |
| Sprint 6 complete (Testing + Launch) | End of Week 6 |
| First pilot customer live | Week 6–7 |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Jan 2025 | Zendesk-first, not multi-platform | Reduce scope, faster MVP |
| Jan 2025 | English-only for MVP | UAE B2B is English-primary; Arabic adds complexity |
| Jan 2025 | No auto-send | Build trust with HITL approach |
| Jan 2025 | Use Bitext dataset | Avoid manual data generation |
| Jan 2025 | Supabase over separate services | Simplifies stack, faster development |
| Jan 2025 | No billing in MVP | Pilot customers use free; validate first |

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Product Owner | | |
| Tech Lead | | |

---

## Usage

This document is the **source of truth** for MVP scope. Any feature requests should be evaluated against this document. If it's not listed in "Core Features," it's out of scope unless this document is formally updated.

### Scope Change Process
1. Raise the request with rationale
2. Evaluate impact on timeline
3. Update this document if approved
4. Communicate to team
