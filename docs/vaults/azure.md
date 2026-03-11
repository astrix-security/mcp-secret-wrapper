# Azure Key Vault

This guide covers how to use MCP Secret Wrapper with Azure Key Vault to securely inject secrets into your MCP servers.

## Overview

Using MCP Secret Wrapper, you can securely retrieve secrets from Azure Key Vault and inject them as environment variables into your MCP servers.

## Prerequisites

- Azure account with Key Vault access
- Azure credentials configured (see [Authentication](#authentication))
- Node.js installed

## Authentication

MCP Secret Wrapper supports 2 Azure authentication methods: DefaultAzureCredential (automatic) and explicit Service Principal credentials.

### DefaultAzureCredential (Recommended)

The `DefaultAzureCredential` automatically tries multiple authentication methods in order:

1. **Environment variables**: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
2. **Managed Identity**: Azure VM, App Service, Functions, etc.
3. **Azure CLI**: Authenticate using `az login`
4. **Other methods**: Visual Studio Code, PowerShell, etc.

For local development, the simplest approach is Azure CLI:

```bash
az login
```

### Service Principal

Create a service principal and provide credentials explicitly:

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Microsoft Entra ID** > **App registrations**
3. Create a new application registration
4. Create a client secret under **Certificates & secrets**
5. Grant the service principal **Key Vault Secrets User** role on your Key Vault

Provide the credentials via configuration parameters (see [Configuration](#configuration)).

## Configuration

The Azure plugin supports 5 optional configuration parameters. At least one of `vaultUrl`, `vaultName`, or the `AZURE_KEYVAULT_URL` environment variable must be set.

- `vault-vaultUrl` - Full vault URL, e.g. `https://myvault.vault.azure.net`
- `vault-vaultName` - Vault name (builds URL as `https://{name}.vault.azure.net`)
- `vault-tenantId` - Azure tenant ID for service principal authentication
- `vault-clientId` - Azure client (application) ID for service principal authentication
- `vault-clientSecret` - Azure client secret for service principal authentication

**Vault URL resolution priority**: `vaultUrl` > `vaultName` > `AZURE_KEYVAULT_URL` environment variable.

### Command Line Arguments

```json
{
  "mcpServers": {
    "myServer": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://github.com/astrix-security/mcp-secret-wrapper",
        "--vault-type=azure",
        "--vault-vaultUrl=https://myvault.vault.azure.net",
        "API_KEY=my-api-key",
        "--",
        "npx",
        "-y",
        "@my-org/my-mcp-server"
      ]
    }
  }
}
```

### Environment Variables

```json
{
  "mcpServers": {
    "myServer": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://github.com/astrix-security/mcp-secret-wrapper",
        "API_KEY=my-api-key",
        "--",
        "npx",
        "-y",
        "@org/mcp-server"
      ],
      "env": {
        "VAULT_TYPE": "azure",
        "VAULT_VAULTURL": "https://myvault.vault.azure.net"
      }
    }
  }
}
```

### Service Principal via Environment Variables

```json
{
  "mcpServers": {
    "myServer": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://github.com/astrix-security/mcp-secret-wrapper",
        "API_KEY=my-api-key",
        "--",
        "npx",
        "-y",
        "@org/mcp-server"
      ],
      "env": {
        "VAULT_TYPE": "azure",
        "VAULT_VAULTURL": "https://myvault.vault.azure.net",
        "VAULT_TENANTID": "your-tenant-id",
        "VAULT_CLIENTID": "your-client-id",
        "VAULT_CLIENTSECRET": "your-client-secret"
      }
    }
  }
}
```

## Secret Management

### Creating Secrets

#### Using Azure CLI

```bash
# Create a simple string secret
az keyvault secret set \
  --vault-name myvault \
  --name my-api-key \
  --value "api_key_value_example"

# Create a JSON secret
az keyvault secret set \
  --vault-name myvault \
  --name my-db-config \
  --value '{"username": "demo_user", "password": "demo_password"}'
```

#### Using Azure Portal

1. Go to your Key Vault in the Azure Portal
2. Navigate to **Secrets**
3. Click **Generate/Import**
4. Enter your secret name and value
5. Optionally set activation/expiration dates
6. Click **Create**

### Secret Names

Azure Key Vault uses simple names to identify secrets. You provide just the secret name:

```
my-api-key
my-database-password
```

To reference a specific version, append the version GUID with `/`:

```
my-api-key/7c4e962efc7e42c6b4e98e73bfb0ea01
```

If no version is specified, the latest version is used.

## Troubleshooting

### Common Issues

#### 1. Access Denied

```
Error: The user, group or application does not have secrets get permission
```

**Solution**: Ensure your identity has the **Key Vault Secrets User** role or the **Get** secret permission on the Key Vault access policy.

#### 2. Secret Not Found

```
Error: Secret not found: my-secret
```

**Solution**: Verify the secret name exists in your Key Vault. Check for typos and that you're targeting the correct vault.

#### 3. Invalid Vault URL

```
Error: Azure Key Vault URL is required
```

**Solution**: Provide the vault URL via `--vault-vaultUrl`, `--vault-vaultName`, or set the `AZURE_KEYVAULT_URL` environment variable.
