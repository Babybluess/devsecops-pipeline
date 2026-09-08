# devsecops-pipeline

Production-ready GitHub Actions security pipeline templates for Node.js/TypeScript and Python projects. Integrates 8 security gates that run automatically on every push and pull request.

Author: **Hoang Minh Thang** — [github.com/Babybluess](https://github.com/Babybluess)

---

## Workflows

| File | Trigger | Purpose |
|---|---|---|
| `security.yml` | push, PR, weekly | Full security pipeline (8 gates) |
| `pr-security-gate.yml` | PR only | Fast checks (<3 min) with PR comment |
| `weekly-deep-scan.yml` | Sunday 23:00 UTC | Deep scan + Slack notification |
| `codeql.yml` | push, PR, Wednesday | GitHub CodeQL static analysis |

---

## Security Gates

```
                         ┌─────────────────┐
  push / PR ────────────▶│  Secret Scan     │ ← First gate (fastest)
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     ┌────────────────┐  ┌───────────────┐  ┌──────────────────┐
     │  SAST (Semgrep)│  │ Dep Audit     │  │ IaC Scan         │
     │  + CodeQL      │  │ npm/pip-audit │  │ (Checkov)        │
     └────────┬───────┘  └───────┬───────┘  └──────────────────┘
              │                  │
              └────────┬─────────┘
                       ▼
              ┌─────────────────┐
              │ Container Scan   │ ← Only on push (not PR)
              │ (Trivy + Hadolint│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ DAST (ZAP)      │ ← Only on push to main/develop
              │ Against staging  │   with STAGING_URL set
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Security Summary │
              └─────────────────┘
```

### Gate Details

| Gate | Tool | Catches | Fails on |
|---|---|---|---|
| **Secret Scan** | detect-secrets + Gitleaks | API keys, tokens, passwords in code/git history | Any secret detected |
| **SAST** | Semgrep + custom rules | OWASP Top 10, SQLi, XSS, JWT issues, hardcoded secrets | ERROR severity findings |
| **Dependency Audit** | npm audit + pip-audit | Known CVEs in dependencies (NVD database) | HIGH or CRITICAL CVEs |
| **License Check** | license-checker | GPL/AGPL/LGPL in dependency tree | Forbidden licenses |
| **Container Scan** | Trivy + Hadolint | OS CVEs in Docker image, Dockerfile misconfigs | CRITICAL or HIGH CVEs |
| **IaC Scan** | Checkov | K8s/Terraform/Docker-Compose misconfigurations | Policy violations |
| **DAST** | OWASP ZAP | Live endpoint vulnerabilities (XSS, SQLi, SSRF) | Configured in `.zap/rules.tsv` |
| **CodeQL** | GitHub CodeQL | Deep dataflow analysis, logic vulnerabilities | ERROR severity findings |

---

## Setup

### 1. Copy workflows to your project

```bash
cp -r .github/ /path/to/your-project/
cp -r .semgrep/ /path/to/your-project/
cp -r .zap/ /path/to/your-project/
cp .secrets.baseline /path/to/your-project/
```

### 2. Configure GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Required | Description |
|---|---|---|
| `SEMGREP_APP_TOKEN` | Optional | Semgrep Cloud dashboard (free at semgrep.dev) |
| `GITLEAKS_LICENSE` | Optional | Gitleaks Pro for org-level scanning |
| `SLACK_WEBHOOK_URL` | Optional | Weekly scan Slack notifications |

### 3. Configure GitHub Variables

Go to **Settings → Variables → Actions** and add:

| Variable | Required | Description |
|---|---|---|
| `STAGING_URL` | For DAST | URL of your staging environment (e.g. `https://staging.yourapp.com`) |

### 4. Enable GitHub Advanced Security (for CodeQL)

- **Public repos**: CodeQL is free
- **Private repos**: Requires GitHub Advanced Security (GHAS)
- Enable at: **Settings → Code security and analysis**

### 5. Set branch protection rules

Go to **Settings → Branches → Branch protection rules** for `main`:

```
✅ Require status checks to pass before merging:
   - Secret Scan
   - SAST (Semgrep)
   - Dependency Audit
   - PR Security Gate / Quick Secret Scan
   - PR Security Gate / Quick SAST
```

---

## Custom Semgrep Rules

The `.semgrep/custom-rules.yml` file contains 9 project-specific rules:

| Rule ID | What it catches |
|---|---|
| `hardcoded-jwt-secret` | `jwt.sign(payload, "literal-string")` |
| `jwt-missing-expiry` | `jwt.sign()` without `expiresIn` option |
| `sql-string-concat` | SQL built with `+` or template literals |
| `dangerous-eval` | `eval()` and `new Function()` calls |
| `insecure-random-security` | `Math.random()` for security purposes |
| `log-sensitive-data` | `console.log(user.password)` etc. |
| `ssl-verification-disabled` | `rejectUnauthorized: false` |
| `nestjs-unguarded-route` | POST/PUT/DELETE without `@UseGuards()` |
| `python-shell-injection` | `subprocess.run(cmd, shell=True)` |

### Adding new rules

```yaml
# .semgrep/custom-rules.yml
rules:
  - id: my-custom-rule
    pattern: dangerous_function($X)
    message: "Describe what is wrong and how to fix it"
    languages: [typescript]
    severity: ERROR  # ERROR | WARNING | INFO
    metadata:
      category: security
      cwe: "CWE-XXX: ..."
      remediation: "How to fix this"
```

---

## Running locally

```bash
# Install tools
pip install semgrep detect-secrets
npm install -g license-checker

# Run all security checks locally
npm run security:all

# Run individual checks
npm run security:sast      # Semgrep SAST
npm run security:secrets   # Secret scan
npm run security:deps      # npm audit
npm run security:licenses  # License check

# Run custom Semgrep rules
semgrep --config .semgrep/custom-rules.yml sample-app/

# Scan for secrets
detect-secrets scan --no-verify .

# Update secrets baseline after acknowledging a false positive
detect-secrets scan > .secrets.baseline
```

---

## Exit Codes & CI/CD Behaviour

| Gate result | PR | Push to main |
|---|---|---|
| Secret detected | ❌ Block merge | ❌ Fail build |
| SAST ERROR finding | ❌ Block merge | ❌ Fail build |
| HIGH/CRITICAL CVE | ❌ Block merge | ❌ Fail build |
| Forbidden license | ❌ Block merge | ❌ Fail build |
| Container CRITICAL | ⏭️ Not run on PR | ❌ Fail build |
| DAST finding | ⏭️ Not run on PR | ⚠️ Warn only |

---

## File Structure

```
.github/
  workflows/
    security.yml              ← Full pipeline (8 gates)
    pr-security-gate.yml      ← Fast PR checks (<3 min)
    weekly-deep-scan.yml      ← Sunday deep scan + Slack
    codeql.yml                ← GitHub CodeQL analysis
.semgrep/
  custom-rules.yml            ← Project-specific SAST rules (9 rules)
.zap/
  rules.tsv                   ← ZAP DAST rule configuration
.secrets.baseline             ← detect-secrets known-safe baseline
Dockerfile                    ← Security-hardened multi-stage example
package.json                  ← With security scripts
sample-app/
  src/app.ts                  ← Intentionally vulnerable code (demo)
README.md
```

---

## Why each tool was chosen

| Tool | Alternative | Why this one |
|---|---|---|
| **Semgrep** | ESLint security, Bandit | Multi-language, fast, excellent OWASP rules, free |
| **detect-secrets** | GitGuardian | Runs locally, no API dependency, customisable |
| **Gitleaks** | truffleHog | Scans full git history, not just current files |
| **Trivy** | Snyk, Grype | Open source, fast, covers OS + app layer, SARIF output |
| **Checkov** | tfsec, KICS | Covers Dockerfile + K8s + Terraform in one tool |
| **OWASP ZAP** | Burp Suite (CI), Nikto | Free, Docker-based, maintained by OWASP |
| **CodeQL** | SonarQube | Deep dataflow analysis, free for public repos |
| **npm audit** | Snyk | Built-in, no token required, NVD-backed |

---

## Compliance Coverage

The pipeline helps satisfy requirements from:

- **OWASP Top 10** — SAST rules, DAST, dependency audit
- **NIST SP 800-53** — Source code review, vulnerability scanning
- **SOC 2 Type II** — Automated security testing in CI/CD
- **ISO 27001** — Secure development lifecycle controls
- **PCI DSS** — Vulnerability management, code review requirements
