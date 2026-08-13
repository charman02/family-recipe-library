# issei on AWS — deploy → verify → capture → destroy

A **verify-and-teardown** runbook. The goal is not to *run* issei on AWS long-term —
it stays on the free stack (Vercel + Render + Neon) until real usage justifies the
~$36/mo. The goal is to prove the ECS/Fargate/CDK/OIDC infrastructure genuinely
works end-to-end, capture the evidence, and tear it down (~$1–3 for a few hours).
Re-spin any time with the same steps.

**No custom domain in this mode.** The API is served over HTTP on the raw ALB DNS
(`http://<alb>.us-west-2.elb.amazonaws.com`). That's enough to prove the deploy.
To serve HTTPS at `api.<domain>` later: register the domain in Route53, uncomment
the two lines in `infra/bin/issei.ts`, redeploy — no other change.

Everything below runs with **your** AWS credentials, in **us-west-2**. Nothing here
was run for you; each step is yours to execute and watch.

---

## Prerequisites (one-time on your machine)

- **AWS CLI v2** configured: `aws sts get-caller-identity` should return your account.
  Use least-privilege creds you're comfortable creating infra with (this stack makes
  a VPC, ALB, ECS, IAM roles, an OIDC provider).
- **Node 18+** and **Docker** (the CDK builds the container image locally to push).
  Docker Desktop must be running.
- From `infra/`: `npm install` (already done in this worktree if `node_modules/` exists).
- The 6 app secrets, available in the repo-root `.env` (DATABASE_URL, JWT_SECRET,
  CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, OPENROUTER_API_KEY).

Set these once per shell session:
```bash
export AWS_REGION=us-west-2
export AWS_DEFAULT_REGION=us-west-2
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "account: $ACCOUNT  region: $AWS_REGION"
```

---

## Step 1 — Put the 6 secrets in SSM Parameter Store (SecureString, free tier)

The task definition reads these at `/issei/prod/<NAME>`. Source them from the
repo-root `.env` so no secret is ever typed or committed. Run from the **repo root**:

```bash
set -a; source .env; set +a   # loads DATABASE_URL, JWT_SECRET, CLOUDINARY_*, OPENROUTER_API_KEY

for NAME in DATABASE_URL JWT_SECRET CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET OPENROUTER_API_KEY; do
  aws ssm put-parameter \
    --name "/issei/prod/$NAME" \
    --type SecureString \
    --value "${!NAME}" \
    --overwrite \
    --region "$AWS_REGION" >/dev/null && echo "  ✓ /issei/prod/$NAME"
done
```

Verify they exist (names only, values stay encrypted):
```bash
aws ssm get-parameters-by-path --path /issei/prod --region "$AWS_REGION" \
  --query 'Parameters[].Name' --output text
```

> DATABASE_URL should be the Neon **pooler** endpoint with `?sslmode=require` — the
> same one Render uses. (The GitHub Actions migration path wants the non-pooler
> endpoint, but that path isn't used for this artifact.)

---

## Step 2 — Bootstrap CDK (one-time per account/region)

```bash
cd infra
npx cdk bootstrap "aws://$ACCOUNT/$AWS_REGION"
```
Creates the CDK toolkit stack (an S3 bucket + roles CDK uses to push assets). Safe to
re-run; no-op if already bootstrapped.

---

## Step 3 — Deploy

```bash
cd infra
npx cdk deploy
```
Review the IAM/security-group changes it prints, type `y`. First deploy takes
~10–15 min (it builds the ARM64 image, pushes to ECR, then stands up VPC → ALB →
ECS service and waits for the task to pass health checks).

On success it prints outputs, including:
```
IsseiStack.ApiUrl = http://IsseiStack-Alb...elb.amazonaws.com
IsseiStack.AlbDns = IsseiStack-Alb...elb.amazonaws.com
IsseiStack.DeployRoleArn = arn:aws:iam::...:role/issei-github-deploy
```
Save `ApiUrl` — that's your live API. Export it for the checks:
```bash
API=$(aws cloudformation describe-stacks --stack-name IsseiStack --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
echo "$API"
```

---

## Step 4 — Verify it actually works (the evidence)

```bash
# liveness + readiness (readiness proves the task reached Neon)
curl -s "$API/health"            # → {"status":"ok"}
curl -s "$API/health/ready"      # → {"status":"ready"}   ← DB reachable from Fargate

# a real authenticated round-trip
curl -s -X POST "$API/auth/signup" -H 'Content-Type: application/json' \
  -d '{"first_name":"Aws","last_name":"Demo","email":"aws-demo@example.com","password":"pw123456"}'
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=aws-demo@example.com&password=pw123456' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "$API/auth/me" -H "Authorization: Bearer $TOKEN"   # → the user

# a recipe create (exercises the DB write path end to end)
curl -s -X POST "$API/recipes" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"AWS Adobo","servings":4,"steps":[{"content":"Simmer","position":1}]}'
```
> This writes a test user + recipe to your **real Neon prod DB**. Either use a throwaway
> Neon branch for the demo, or delete the `aws-demo@example.com` rows afterward.

### Capture (this is the interview artifact)
- Terminal: the `cdk deploy` outputs + the curl results above.
- AWS Console screenshots: **ECS** (cluster → service → task RUNNING, health passing),
  **EC2 → Load Balancers** (the ALB), **CloudWatch → Log groups → /ecs/issei-api**
  (real application logs from the running container), **IAM** (the `issei-github-deploy`
  OIDC role).
- A cost note: **Cost Explorer** or the Billing dashboard after a few hours.

---

## Step 5 — Destroy (stop the meter)

```bash
cd infra
npx cdk destroy
```
Removes the VPC, ALB, ECS service, log group, IAM roles, OIDC provider. Then:

```bash
# the ECR repo holding the pushed image is a CDK asset repo; images may linger.
# Optional cleanup if you want zero footprint:
aws ssm delete-parameters --names \
  /issei/prod/DATABASE_URL /issei/prod/JWT_SECRET /issei/prod/CLOUDINARY_CLOUD_NAME \
  /issei/prod/CLOUDINARY_API_KEY /issei/prod/CLOUDINARY_API_SECRET /issei/prod/OPENROUTER_API_KEY \
  --region "$AWS_REGION"
```
The CDK **bootstrap** stack (`CDKToolkit`) is fine to leave — it costs ~nothing and
saves re-bootstrapping next time. Confirm nothing expensive remains:
```bash
aws elbv2 describe-load-balancers --region "$AWS_REGION" --query 'LoadBalancers[].LoadBalancerName'
aws ecs list-clusters --region "$AWS_REGION"
```
Both should be empty (or not list `issei`).

---

## Known snags (a first ECS/CDK deploy usually hits one or two)

Each of these is itself a "Dive Deep" story worth writing down.

- **Task fails health checks / stuck "PENDING → STOPPED" loop.** Read the stopped
  task's *Stopped reason* in the ECS console and the CloudWatch logs. Usual causes:
  a secret missing from SSM (Step 1) → the app crashes on `Settings()` at import; or
  the container can't reach Neon (check the task's security-group egress + that the
  DATABASE_URL is the correct pooler host with `sslmode=require`).
- **Health check flapping though the app is up.** The ALB target group hits
  `/health/ready`, which does a real DB `SELECT 1`. If Neon is unreachable it returns
  500 and the target never goes healthy — which is *by design* (better than "green"
  over a dead DB), but means fix the DB reachability, not the health path.
- **`cdk deploy` can't build the image.** Docker Desktop not running, or not able to
  build `linux/arm64` (needs buildx / QEMU on an x86 machine — Docker Desktop has it
  by default). The base image is digest-pinned and verified multi-arch, so the FROM
  line itself is fine.
- **`Need to perform AWS calls for account …, but no credentials`** during synth/deploy
  → your shell lost its AWS creds; re-run the `export` block at the top.
- **Bootstrap complains about an existing CDKToolkit** → harmless, it's already there.

---

## What ships vs. what's parked

This runbook + the `infra/` stack + the Dockerfile are committed on the
`aws-migration` branch. They are **not** merged to `main` and **do not** deploy
anything on their own — `main` still auto-deploys the frontend/backend to
Vercel/Render as before. The `/health/ready` endpoint added to `app/main.py` is part
of this branch too; it's harmless on Render (an unused extra route) but only becomes
load-bearing behind the ALB target group here.
