# MCP Secret Wrapper Documentation

Welcome to the MCP Secret Wrapper documentation. This directory contains detailed guides for using different vaults to retrieve secrets dynamically for MCP servers.

## Available Vaults

### [AWS Secrets Manager](./vaults/aws.md)
Complete guide for integrating with AWS Secrets Manager, including authentication, configuration, and best practices.

## Quick Start

1. Choose your vault provider from the list above
2. Follow the specific documentation for your chosen vault
3. Configure your MCP server to use the vault
4. Test your setup with the provided examples

## General Concepts

### Vault Types
MCP Secret Wrapper supports multiple vault types through a plugin architecture. Each vault type has its own configuration requirements and authentication methods.

### Secret References
Secrets are referenced using vault-specific identifiers:
- **AWS**: ARN format (`arn:aws:secretsmanager:region:account:secret:name`)

### Configuration Methods
You can configure vault settings using:
- Command line arguments (`--vault-type`, `--vault-region`)
- Environment variables (`VAULT_TYPE`, `VAULT_REGION`)

## Contributing

Want to add support for a new vault? See our [Contributing Guide](../CONTRIBUTING.md) for details on how to implement new vault plugins.
