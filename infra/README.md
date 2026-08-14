# issei on AWS — infrastructure as code

This directory is the entire AWS deployment for the issei API, defined in the
[AWS CDK](https://aws.amazon.com/cdk/) (TypeScript). One `cdk deploy` stands up a
container platform for the FastAPI backend: networking, load balancer, a Fargate
service, secrets, logging, TLS, and a keyless CI/CD role — all versioned here, no
click-ops.

- **[`lib/issei-stack.ts`](lib/issei-stack.ts)** — the whole stack (~260 lines).
- **[`bin/issei.ts`](bin/issei.ts)** — entry point + configuration (region, domain).
- **[`RUNBOOK.md`](RUNBOOK.md)** — exact deploy → verify → destroy commands.
- **[`../Dockerfile`](../Dockerfile)** — the container image (ARM64, non-root, pinned).
- **[`../.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)** — the
  push-to-deploy pipeline (OIDC, gated migrations).

---

## Why AWS at all — the honest version

**issei does not need this.** At its traffic, the free stack it already runs on
(Vercel + Render + Neon) serves it fine for ~$0/month. This migration is a
**deliberate infrastructure exercise**, not a scaling necessity — and naming that
plainly is the point. The value is demonstrating, end to end, that the API can be
containerized, defined as code, deployed to a production-grade orchestrator, and
shipped by a keyless pipeline — and that I can weigh what that costs against what it
buys before reaching for it in a real job.

The cost is real and I'd state it in the same breath: **~$36/month**, of which
roughly $24 is the Application Load Balancer and its public IPs — billed even at
zero traffic. For a low-traffic app in a job where money mattered, I'd stay on the
managed platform (or use a cheaper compute like App Runner / a single container on
Fly/Render) until traffic justified the ALB. Building it here was the goal; running
it long-term would need a reason this app doesn't yet have.

---

## Architecture at a glance

```
                 Internet
                    │  HTTPS :443  (or HTTP :80 with no custom domain)
                    ▼
     ┌──────────────────────────────┐
     │  Application Load Balancer    │  ACM cert · health check → /health/ready
     │  (public subnets, 2 AZs)      │
     └──────────────┬───────────────┘
                    │  :8000  (SG: ALB → task only)
                    ▼
     ┌──────────────────────────────┐        ┌───────────────────────────┐
     │  ECS Fargate service          │  ───▶  │ SSM Parameter Store        │
     │  1× task, ARM64 (Graviton)    │        │ (SecureString secrets)     │
     │  FastAPI + uvicorn :8000      │        └───────────────────────────┘
     │  public subnet + public IP    │  ───▶  Neon Postgres (public internet, TLS)
     │  (egress via IGW, no NAT)     │  ───▶  Cloudinary · OpenRouter (HTTPS)
     └──────────────┬───────────────┘
                    │  awslogs
                    ▼
              CloudWatch Logs  (/ecs/issei-api)

   GitHub Actions ──(OIDC, no stored keys)──▶ assume issei-github-deploy role
                                              build → push ECR → update service
```

---

## The decisions, and why (each one defensible)

### 1. Fargate, not Lambda — because of the product's own constraints
Lambda was the cheaper instinct (~$1–5/mo vs ~$36). Two things in *this* app rule it
out without re-architecture:
- **A 10 MB photo upload proxied through the API.** Lambda's synchronous payload cap
  is 6 MB. Supporting it on Lambda means presigned-S3 uploads — a real re-design of a
  working feature. I chose not to shrink the product to fit the cheaper compute.
- **A synchronous ~25 s LLM call** (`POST /recipes/parse` → OpenRouter). Livable on
  Lambda, but it pushes toward Lambda's timeout and pricing-by-duration model.

Fargate runs the container as-is, with a long-lived process and no payload ceiling.
The tradeoff I'm accepting is the ALB's standing cost. *If asked "why not App
Runner?"* — it's the genuinely cheaper middle ground and I'd pick it for a real
low-traffic launch; I used Fargate + ALB here because standing up the VPC / SG /
target-group / task-def layer myself is the part worth demonstrating.

### 2. ARM64 (Graviton)
The task runs `arm64`; the Dockerfile builds `linux/arm64`. Graviton Fargate is
~20% cheaper than x86 for the same vCPU/memory, and this is a plain Python image with
no x86-only wheels — so it's free savings. The base image is pinned to the
**multi-arch index digest** (verified to contain a `linux/arm64/v8` variant), so the
pin is reproducible and `--platform linux/arm64` selects the Graviton build.

### 3. No NAT Gateway — public subnets + `assignPublicIp`
A NAT Gateway is ~$33/mo plus data processing — nearly doubling the bill. It exists
to give *private* subnets outbound internet. But every dependency this task calls is
**public-internet reachable**: Neon (over TLS), Cloudinary, OpenRouter, ECR, SSM,
CloudWatch. So the task sits in a **public subnet with a public IP and egresses via
the Internet Gateway** — $0, and the security posture is held by the **security
group**, not the subnet: the task's SG accepts ingress *only* from the ALB's SG on
:8000; nothing reaches it directly. *The tradeoff I'd name:* a public-subnet task has
a larger blast radius than a private one. In a compliance context I'd pay for the NAT
and go private; here the SG is the right-sized control.

### 4. Secrets in SSM Parameter Store (SecureString), injected by the task
Six secrets (DB URL, JWT secret, Cloudinary ×3, OpenRouter key) live in SSM as
encrypted SecureStrings under `/issei/prod/*`. The task definition references them by
ARN, so ECS injects them as environment variables at container start — **they are
never in the image, the repo, the task-def JSON, or CloudFormation output.** Standard
tier is free. *Why SSM over Secrets Manager:* Secrets Manager (~$0.40/secret/mo +
rotation) buys automatic rotation this app doesn't use; SSM SecureString is the frugal
correct choice until rotation is a requirement.

### 5. GitHub Actions deploys via OIDC — no long-lived AWS keys
The CI/CD pipeline assumes an IAM role (`issei-github-deploy`) through GitHub's OIDC
identity provider. **There are no AWS access keys stored in GitHub secrets** — the
workflow presents a short-lived OIDC token, and the role's trust policy only accepts
it from `repo:<org>/issei:ref:refs/heads/main`. This is the current best practice: no
static credential to leak, scoped to one repo and one branch. The role's permissions
are least-privilege (ECR push to one repo, ECS service update, `iam:PassRole` scoped
to exactly the task + execution roles) rather than a blanket policy.

### 6. A readiness probe that fails closed (`/health/ready`)
The ALB target group health-checks **`/health/ready`**, which runs a real
`SELECT 1` against Neon — not `/health`, which only proves the process is up. The
reasoning: a task that booted but *can't reach the database* is useless, and a
liveness-only check would mark it healthy and route real traffic to it, which then
500s. Gating readiness on DB reachability means such a task **fails its health check
and the ECS deployment circuit breaker rolls it back**, instead of serving errors
under a green light. Fail closed, not open.

### 7. Migrations run gated in CI, never in the container entrypoint
(In the GitHub Actions pipeline.) Alembic `upgrade head` runs as a **gated step
before** the ECS service is updated — a failed migration blocks the deploy, and the
image is never pushed. It deliberately does **not** run in the container's entrypoint:
ECS rolling deploys briefly run old and new tasks together against the *same* Neon
DB, so an entrypoint migration (e.g. a column drop) would break the still-serving old
task mid-deploy. Migrations use Neon's **direct** (non-pooler) endpoint so advisory
locks work; the app uses the **pooler** endpoint at runtime.

### 8. Domain is optional — one flag, not a rewrite
`bin/issei.ts` toggles a custom domain. **With it** (`domainName` + `apiSubdomain`
set): an ACM certificate, DNS-validated against the Route53 hosted zone, serves HTTPS
at `api.<domain>`, with an HTTP→HTTPS redirect and a Route53 A-alias to the ALB.
**Without it:** the ALB serves the API directly over HTTP on its raw AWS hostname —
no cert, no Route53, no paid domain — which is enough to prove the deploy works. The
stack branches on a single `useDomain` boolean, so turning HTTPS on later is a config
change, not a structural one. (This is why the stack can be a cheap verify-and-teardown
artifact *or* a real HTTPS deployment from the same code.)

---

## Cost breakdown (us-west-2, ~730 hr/mo, single task)

| Line item | ~Monthly |
|---|---|
| Fargate ARM 0.25 vCPU / 0.5 GB, 24×7 | ~$7 |
| Application Load Balancer (hourly + ~1 LCU) | ~$17 |
| Public IPv4 addresses (ALB ×2 AZ + 1 task) | ~$11 |
| ECR storage · CloudWatch Logs · SSM · ACM · data transfer | ~$0–1 |
| **Total** | **~$36** |

The ALB + its unavoidable public IPs are ~$24 of that and bill at zero traffic —
which is exactly why this is an artifact, not the app's permanent home. `cdk destroy`
takes it all down; re-`cdk deploy` brings it back.

---

## What I'd add before this served real production traffic

Stated up front, because knowing the gaps is the point of building it:

1. **≥2 tasks across AZs** for real availability (currently 1 task = a single-AZ SPOF).
   The gated-migration design already assumes horizontal scale, so this is a count change.
2. **Autoscaling** on CPU/request count — the service is fixed at `desiredCount: 1`.
3. **Rate limiting / WAF** in front of the ALB — the `/parse` endpoint spends money per
   call and auth is its only gate today.
4. **Alarms + dashboards** (CloudWatch) on 5xx rate, task health, and DB errors — right
   now failures are visible in logs but nothing pages.
5. **Private subnets + NAT** if a compliance posture ever required no public-IP tasks.
6. **Secrets Manager with rotation** if the secrets policy demanded it.

None of these are hard to add; each is a deliberate scope cut for a portfolio artifact,
not an oversight — and that distinction is the thing worth being able to draw.
