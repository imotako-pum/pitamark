# Privacy Policy (pitamark)

> **DRAFT — machine-translated from `privacy-ja.md` (Phase 10.D, 2026-05-05).**
> This English version is a working draft generated for non-Japanese-reading users. **The Japanese version (`privacy-ja.md`) is the authoritative legal text.** In any conflict between this translation and the Japanese version, the Japanese version prevails. Owner-led human review is pending (Phase 10.F or later).

**Last updated**: 2026-05-05
**Version**: draft-v0.1.0 (Phase 10.D, en translation pending review)

## 1. Introduction

This Privacy Policy (the "Policy") sets out the types of information collected from users, their purposes, third-party disclosure, retention periods, and disclosure request procedures for the image annotation sharing service pitamark (the "Service") operated by [TBD: name / handle to be specified after Phase 10.D] (the "Operator").

By using the Service, users are deemed to have agreed to the contents of this Policy.

## 2. Basic Policy on Personal Information Collection

The Service is designed as a lightweight, **no-account-required, cookieless** service. As a rule, direct personal information such as name, email address, or phone number is NOT collected.

## 3. Information Collected

The Service automatically collects and processes the following information.

| Information | Collection Trigger | Storage Location | Retention |
|---|---|---|---|
| Uploaded images (PNG / JPEG / WebP / SVG) | Room creation | Cloudflare R2 (US / EU regions) | According to TTL (24 hours to max 7 days) |
| Annotation data (rectangles / arrows / text / highlights — coordinates, colors, text, etc.) | Annotation create/edit | Cloudflare Durable Object | According to TTL |
| Room password hash (PBKDF2-SHA256 210k iterations) | When password protection is enabled | Cloudflare R2 (same location as metadata) | According to TTL |
| Access IP address | API request | Cloudflare logs (short-term) / Workers logs | According to Cloudflare retention policy (typically several days) |
| User-Agent | API request | Same as above | Same as above |
| Access timestamp / route information | API request | Same as above | Same as above |
| Web Analytics data (page views, referrers, aggregated values) | Page access | Cloudflare Web Analytics (cookieless) | According to Cloudflare retention policy |

**Important**:

- Users are responsible for managing the information they upload to the Service. **Do not upload personal or confidential information.**
- Images and annotation data are automatically deleted after the room TTL expires. Important data should be separately preserved by means such as PNG export within the TTL.

## 4. Purposes of Use

Collected information is used for the following purposes:

1. Provision of the Service (image / annotation storage and delivery, collaborative editing functionality)
2. Operation and improvement of the Service (bug fixes, decision-making for feature additions, UI/UX improvements)
3. Detection and prevention of unauthorized use (Cloudflare Turnstile, Workers Rate Limit, SHA-256 blocklist, etc.)
4. Creation and analysis of usage statistics (analysis of aggregated data via Cloudflare Web Analytics)
5. Response to reports (review and action on Article 4 violations)
6. Compliance with laws (formal requests from judicial authorities, etc.)

## 5. Cookies / Tracking Technologies

1. The Service does NOT use cookies for tracking purposes (cookieless policy).
2. Browser sessionStorage / localStorage is used solely for retaining local state (e.g., temporary storage of room access tokens). These are NOT transmitted outside the Service.
3. Cloudflare Web Analytics (cookieless design, IP address anonymization) is used for access analytics.
4. Google Analytics / Facebook Pixel / other third-party advertising tracking is NOT currently implemented. Future introduction will be announced via amendment to this Policy.

## 6. Disclosure to Third Parties

1. The Service does not sell or transfer user information to third parties.
2. However, except in the following cases, information will not be provided without user consent:
   - When there is a formal request from judicial authorities and a legal obligation to comply
   - When necessary to prevent serious danger to the life, body, or property of third parties
   - When provided to subcontractors (infrastructure providers such as Cloudflare) within the scope necessary for Service operation (these are confirmed to have management standards equivalent to or higher than this Policy)

## 7. Retention Periods

1. **Images / annotations / authentication metadata**: Automatically deleted after the TTL specified at room creation (default 24 hours, maximum 7 days) expires.
2. **Access logs**: According to Cloudflare's retention policy. The Operator does not retain these long-term.
3. **Web Analytics data**: According to Cloudflare's retention policy.

## 8. Disclosure / Deletion Requests / Complaints

1. Users may request disclosure, deletion, or cessation of use of information related to themselves.
2. Please send requests to the following contact:
   - **GitHub Issue** (recommended): <https://github.com/imotako-pum/pitamark/issues>
   - **Email**: [TBD: contact email to be specified at Phase 10.F public release]
3. Please cooperate to a reasonable extent regarding the request content and identity verification method (when identity verification is required).

## 9. Security Management

1. Communications are encrypted with HTTPS.
2. Passwords for password-protected rooms are stored hashed with PBKDF2-SHA256 (210,000 iterations). Plaintext storage is not performed.
3. WebSocket connections do not carry JWT in the URL; a 1-shot 60-second ticket scheme (via Cloudflare KV) is adopted.
4. Uploaded images use a SHA-256-hash-based blocklist to deter re-upload of illegal / improper content.
5. The Service is operated by an individual and does not provide enterprise-grade SLA / audit support.

## 10. Children's Use

The Service does not have age restrictions, but users under 13 should use it with parental consent. Personal information found to have been collected from users under 13 will be promptly deleted upon confirmation.

## 11. Cross-Border Data Transfer

The Service uses Cloudflare's global infrastructure, and user information may be processed in multiple regions including the US / Europe / Asia Pacific. For Cloudflare's data processing policy, see [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).

## 12. Amendment

1. The Operator may amend this Policy as necessary.
2. When amending, the Operator will announce the changes and effective date on the Service or in the GitHub CHANGELOG / release notes.
3. When making significant changes, the Operator will provide advance notice to users to the extent possible.

## 13. Contact

- **GitHub Issues**: <https://github.com/imotako-pum/pitamark/issues>
- **Reports**: Issues with the `report-abuse` label
- **Privacy-related**: Above issue or [TBD: Operator contact to be added at Phase 10.F public release]

---

*This Policy is a draft that takes effect after final confirmation immediately before public release (Phase 10.F). The Japanese version `privacy-ja.md` is the authoritative text.*
