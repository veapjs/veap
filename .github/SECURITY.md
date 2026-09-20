# Security Policy

Last updated: September 20, 2026

## 1. Overview

Security is an important part of the Veap project.

Veap is a free and open-source framework for building modern web applications. Because the framework may be used in production environments, we take security vulnerabilities seriously and encourage responsible disclosure.

This Security Policy explains how to report security vulnerabilities affecting Veap and how the project handles security reports.

## 2. Supported Versions

Security fixes are generally provided for actively maintained versions of Veap.

| Version | Security Support |
| :--- | :--- |
| Latest stable release | Supported |
| Previous maintained release | Supported when applicable |
| Older releases | Not guaranteed |

Users are encouraged to keep Veap and its dependencies up to date.

Security support for a particular release may depend on the severity of the vulnerability and the maintenance status of that release.

## 3. Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

If you believe you have discovered a security vulnerability in Veap, please report it privately.

**Security contact**  
Email: [security@veap.dev](mailto:security@veap.dev)

If the repository provides GitHub's private security reporting functionality, you may also use the Security Advisories feature available in the relevant Veap repository.

## 4. What to Include in a Report

A useful security report should contain as much relevant information as possible.

Please include:

- a clear description of the vulnerability;
- the affected Veap package or component;
- the affected version or versions;
- steps required to reproduce the issue;
- a minimal reproduction, proof of concept, or example when possible;
- the expected behavior;
- the actual behavior;
- the potential security impact;
- any suggested mitigation or fix, if available.

For example:

```text
Package: @veap/...
Affected version: x.x.x
Vulnerability: ...
Steps to reproduce:
  1. ...
  2. ...
  3. ...
Impact: ...
Proof of concept: ...
```

Do not include real credentials, authentication tokens, private keys, personal data, or other sensitive information in a report.

## 5. Responsible Disclosure

We ask security researchers and users to allow the Veap project reasonable time to investigate and address a reported vulnerability before publicly disclosing technical details.

Please avoid:

- publicly posting an undisclosed vulnerability;
- creating a public GitHub issue containing sensitive vulnerability details;
- exploiting the vulnerability against systems that you do not own or have permission to test;
- accessing, modifying, deleting, or exposing data belonging to other users;
- performing actions that may disrupt production systems.

Good-faith security research is welcome.

## 6. Our Response

When a security report is received, the Veap maintainers will:

- review the report;
- attempt to reproduce the issue;
- assess its severity and potential impact;
- determine affected versions;
- develop or coordinate an appropriate fix;
- release a patched version when appropriate;
- publish security information when appropriate.

Response and remediation times may vary depending on the complexity and severity of the vulnerability.

We do not guarantee a specific response or remediation timeframe.

## 7. Severity

Security vulnerabilities may be assessed using commonly accepted vulnerability severity principles, including the potential impact and exploitability of the issue.

Factors may include:

- remote exploitability;
- required privileges;
- required user interaction;
- confidentiality impact;
- integrity impact;
- availability impact;
- affected components;
- realistic deployment scenarios.

Severity classifications are determined by the Veap maintainers and may differ depending on the specific context.

## 8. Security Advisories

When appropriate, security vulnerabilities may be disclosed through:

- GitHub Security Advisories;
- Veap release notes;
- changelogs;
- security announcements;
- affected package documentation.

A security advisory may include:

- affected versions;
- fixed versions;
- vulnerability description;
- severity;
- impact;
- mitigation instructions;
- acknowledgements for responsible reporters.

The amount of technical information disclosed may be limited when necessary to reduce the risk of exploitation.

## 9. Dependencies

Veap relies on third-party dependencies.

Security vulnerabilities in dependencies may affect Veap even when the vulnerable code is not maintained by the Veap project.

The project may:

- update affected dependencies;
- remove vulnerable dependencies;
- apply available mitigations;
- release a patched Veap version;
- document situations where users must take additional action.

Users should keep both Veap and its dependencies up to date.

## 10. Applications Built with Veap

Veap provides software for building applications but does not operate or control applications created by its users.

Application developers are responsible for the security of their own applications and infrastructure, including:

- authentication;
- authorization;
- database configuration;
- secrets management;
- deployment infrastructure;
- application-specific vulnerabilities;
- third-party integrations;
- user data.

A vulnerability in an application built with Veap should be reported to the operator of that application unless the issue originates from Veap itself.

## 11. Security of the Veap Website and Infrastructure

Security reports concerning the official Veap website or project infrastructure should also be submitted privately using the security contact above.

Please do not perform destructive, disruptive, or unauthorized testing against Veap infrastructure.

Only test systems for which you have explicit authorization.

## 12. Out-of-Scope Reports

The following generally do not qualify as security vulnerabilities in Veap by themselves:

- vulnerabilities in unrelated third-party software;
- vulnerabilities requiring an already-compromised system;
- reports based solely on outdated dependencies when no exploitable impact is demonstrated;
- missing security headers on systems controlled by application developers;
- insecure application configuration introduced by the application developer;
- issues that only affect unsupported versions;
- theoretical issues without a realistic security impact.

This list is not exhaustive.

Reports may be considered individually based on their actual security impact.

## 13. Safe Harbor

We support good-faith security research.

When security research is conducted responsibly and in accordance with this policy, we will consider the research to be authorized to the extent permitted by applicable law.

Security researchers should:

- avoid accessing data that does not belong to them;
- avoid disrupting services;
- avoid persistence or lateral movement;
- stop testing once the vulnerability has been demonstrated;
- report the vulnerability privately;
- give the project a reasonable opportunity to address the issue.

Nothing in this policy grants permission to violate applicable laws or the rights of third parties.

## 14. Recognition

With the reporter's permission, we may acknowledge security researchers who responsibly report vulnerabilities.

We will not publicly disclose a researcher's identity without permission, except where disclosure is required by law.

## 15. Changes to This Policy

This Security Policy may be updated as the Veap project evolves.

The latest version will always be available on the Veap website.

The date of the latest update is shown at the top of this document.

## 16. Contact

For security-related reports:  
Security: [security@veap.dev](mailto:security@veap.dev)

For general project questions:  
General: [hello@veap.dev](mailto:hello@veap.dev)

Please use the security address for vulnerability reports rather than public GitHub issues.

Veap — Open-source framework for modern web applications.
