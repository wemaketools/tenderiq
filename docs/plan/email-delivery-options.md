# TenderIQ — Email Delivery Options (decided for local development, DD-44; hosted provider deferred)

Status: **Local development DECIDED** (DD-44): an SMTP `email` channel using nodemailer, delivered to Mailpit in the local Supabase Docker stack. **Hosted provider DEFERRED** until the first hosted environment; §3 lists the options. Stage A is unaffected (the prototype only displays delivery status).

## 1. Why email matters here

- PRD §14.3 lists formal notices (invitations, addenda, deadline changes, outcome and award notices, complaint updates) that recipients must receive. PRD §14.3 and BR-41/BR-42 require tracking of **issued → attempted → delivered/failed → opened → acknowledged**, with a failed delivery creating an action for the owner.
- Supabase Auth also sends email: invitations, password resets and supplier registration verification.
  - **Locally**, these go to **Mailpit**, the mail catcher already in the Supabase Docker stack, at `http://127.0.0.1:54324`.
  - **Hosted** Supabase needs a **custom SMTP provider** for real use, because the built-in sender is only for testing and is heavily rate-limited. One provider that offers SMTP can serve both Supabase Auth and TenderIQ's own notices.
- Content rule (PRD ADM-12, BR-43): notice emails carry the title, deadline and a link into the app, never confidential bid or evaluation content. The authoritative content stays in the product.

## 2. How it runs locally (identical for every option)

Everything runs in Docker via the Supabase CLI. No external account is needed for development.

```
TenderIQ API (notifications service) ──SMTP──► Mailpit (Supabase Docker stack, SMTP :54325, web UI :54324)
Supabase Auth (invite / reset / verify) ──SMTP──► Mailpit
```

- Enable Mailpit's SMTP port in `supabase/config.toml` (`[inbucket] smtp_port = 54325`).
- The app's `email` delivery channel speaks plain SMTP. Locally, a message accepted by Mailpit is recorded as `delivered`. Hosted, the provider's delivery/bounce/open webhooks update `notification_deliveries`.
- Switching providers is configuration only (host, port, credentials, from-address, webhook secret) plus a small provider-specific webhook parser.

**Dependency note.** Node has no built-in SMTP client. The clean path is **`nodemailer`** (MIT licence, no runtime dependencies, the de-facto standard). It is the one approved new runtime dependency (DD-44). The alternative is to send through the provider's HTTPS API with `fetch` (no dependency) and, locally, through Mailpit's HTTP send API. Whether the Mailpit version bundled with the Supabase CLI exposes that send API would have to be verified first, so this path is less certain.

## 3. Provider options (hosted environments)

Pricing changes often, so check current pricing before deciding. All four offer SMTP (usable by Supabase Auth too), an HTTPS API and delivery-event webhooks.

| Provider | Strengths | Trade-offs | Fit for TenderIQ |
|---|---|---|---|
| **Postmark** | Transactional-only focus with a strong deliverability reputation. Separate "message streams" for transactional vs bulk mail. Rich webhooks (delivery, bounce, spam complaint, open). Good bounce tooling. | Paid from low volumes. Not meant for marketing mail (not needed here). | **Recommended** if notice deliverability is the priority (formal notices, deadlines, BR-41/42 evidence). |
| **Amazon SES** | Lowest cost at volume. SMTP + API. Detailed event publishing (delivery, bounce, complaint, open) via configuration sets. | Needs an AWS account, domain verification (DKIM/SPF) and a production-access request. Event handling goes through SNS/EventBridge, so there is more setup. | Best if the organisation already runs on AWS or expects high volume. |
| **Resend** | Developer-friendly API, SMTP, webhooks, a free tier suitable for dev/pilot. | Younger company with a shorter deliverability track record. | A good low-friction choice for a pilot. |
| **SendGrid / Mailgun** | Mature platforms with SMTP, API and event webhooks. | Broader marketing-oriented products. Deliverability on shared IPs varies by plan. | Viable, but no specific advantage for transactional notices. |

Whichever provider is chosen, production also needs: a sending domain with SPF, DKIM and DMARC records; a separate transactional stream or sub-domain for formal notices; bounce/complaint handling feeding BR-42 delivery-exception tasks; and the same SMTP credentials configured as Supabase Auth's custom SMTP.

## 4. Options considered (owner chose option 1 for local; the hosted provider is deferred)

1. **Approve an email channel now.** Nodemailer + SMTP, with Mailpit locally and a provider named later (for example Postmark) for hosted environments. Stage B then builds the `email` channel alongside `in_app`, with a provider webhook endpoint. *(Recommended.)* **Resolved — DD-44: chosen for local development; the provider webhook endpoint is deferred together with the hosted provider.**
2. **Approve an email channel via HTTPS API only** (no new dependency). This depends on verifying Mailpit's HTTP send API for local development.
3. **Defer.** Keep in-app notices only for this release (the plan before DD-44) and add email later as a new `DeliveryChannel` implementation. The schema already supports it.
