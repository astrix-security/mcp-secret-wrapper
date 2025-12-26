<div align="center">
<img src="https://public-astrix-bucket.s3.us-east-1.amazonaws.com/mcp-wrapper-banner.png" alt="MCP Secret Wrapper Logo" maxWidth="500px"/>

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

</div>

Securely inject secrets from vault systems into MCP (Model Context Protocol) servers without exposing credentials in configuration files.

## Usage

Convert any MCP Server configured for your client and uses a static secret in 2 simple steps:

1. Add the secret to one of the [supported vaults](#support)
2. Replace the server's settings in the configuration file to use MCP Secret Wrapper:
   - Run MCP Secret Wrapper with `npx`
   - Pass any environment variables that should be injected. Their value is the secret location.
   - Place the separator (`--`) followed by the previous command and all its arguments
   - Add the required `VAULT_TYPE` environment variable and any additional optional environment variables either in the `env` section or as CLI arguments (`--vault-type`). You can find examples of both usages in our [Example MCP Server](./example/README.md)

### Example Usage - GitHub MCP with AWS Secret Manager

**Before: Config Environment Variable (❌ Insecure - Hardcoded Secret)**

```json
{
  "mcpServers": {
    "githubApi": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "github_pat_EXAMPLE"
      }
    }
  }
}
```

**After: Using Vault (✅ No Exposed Secret)**

```json
{
  "mcpServers": {
    "githubApi": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://github.com/astrix-security/mcp-secret-wrapper",
        "GITHUB_PERSONAL_ACCESS_TOKEN=arn:aws:secretsmanager:us-east-1:123456789012:secret:example-ABCDE",
        "--",
        "docker",
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "VAULT_TYPE": "aws",
        "VAULT_PROFILE": "aws-profile",
        "VAULT_REGION": "us-east-1"
      }
    }
  }
}
```

https://github.com/user-attachments/assets/9af6e6b3-3694-49de-b107-8749e0630db3

**See what's going on behind-the-scenes by using our example MCP server:** [Example MCP Server](./example/README.md)

## JSON Path Extraction

> **TODO: Document JSON path extraction feature**
> 
> This section will document how to extract specific values from JSON secrets using path notation.
> 
> **Important reminder for documentation:** Make sure to clearly explain the delimiter (`#`) and the limitation that secret IDs should not contain `#` characters when using this feature.

## Support

| Vault Type            | Status         | Description                                                  |
| --------------------- | -------------- | ------------------------------------------------------------ |
| AWS Secrets Manager   | ✅ Supported   | Full support for AWS Secrets Manager with IAM authentication |
| HashiCorp Vault       | 🚧 In-Progress | Support for HashiCorp Vault                                  |
| Azure Key Vault       | 🚧 In-Progress | Support for Azure Key Vault                                  |
| Google Secret Manager | 🚧 In-Progress | Support for Google Secret Manager                            |

**📚 Detailed Documentation:** [Vault Specific Guides](./docs)

## Why?

MCP servers are becoming the backbone of AI agent infrastructure, but most implementations lead to severe risk by exposing hardcoded credentials. Our analysis of 5,000+ MCP server implementations revealed that **over 50% use static, hardcoded API keys and secrets** in their configuration files.

### The Problem

- **Exposed Credentials**: API keys, tokens, and secrets stored in plain text
- **No Rotation**: Static credentials that never expire or rotate
- **Access Control**: No fine-grained access control
- **Compliance**: Violates security best practices and compliance requirements

### The Solution

MCP Secret Wrapper provides:

- **Dynamic Secret Retrieval**: Secrets are fetched at runtime from secure vaults
- **No Hardcoded Secerts**: No secrets are present on the local machine
- **Multi-Vault Support**: Works with AWS, HashiCorp, Azure, and Google vaults

**Read our research:** [Blog](https://astrix.security/blog) - An analysis of 5,000 MCP server implementations and their identity security gap.

## Contributing

We welcome contributions - this tool can and should be improved by the community. Here's how you can help:

### Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add your feature'`
5. Push to your branch: `git push origin feat/your-feature`
6. Open a Pull Request

### Adding New Vault Support

1. Create a new plugin in `src/vaults/plugins/`
2. Implement the `VaultPlugin` interface
3. Add tests for your implementation
4. Update the registry and documentation

For more details, see our [Contributing Guidelines](./CONTRIBUTING.md).

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE) file for details.

## Acknowledgements

- **Yuval Sasson** - For pioneering the initiative to dynamically retrieve secrets for MCP servers
- **Omer Alon** - For developing and releasing the MCP Secert Wrapper tool
- **Oshri Shmuel** - For developing and releasing the MCP Secert Wrapper tool
- **MCP Community** - For creating and maintaining the MCP framework

---

<div align="center">
  <p>Built with ❤️ by the <a href="https://astrix.security">Astrix Security</a> team</p>
  <p>
    <a href="https://astrix.security">Website</a> •
    <a href="https://astrix.security/blog">Blog</a> •
    <a href="https://github.com/astrix-security/mcp-secret-wrapper/issues">Issues</a>
  </p>
</div>
