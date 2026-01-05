# GCP Secret Manager Vault

This guide covers how to use MCP Secret Wrapper with GCP Secret Manager to securely inject secrets into your MCP servers.

## Overview

Using MCP Secret Wrapper, you can securely retrieve secrets from GCP Secret Manager and inject them as environment variables into your MCP servers.

## Prerequisites

- GCP account with Secret Manager access
- GCP credentials configured (see [Authentication](#authentication))
- Node.js installed

## Authentication

MCP Secret Wrapper supports 4 GCP authentication methods: Application Default Credentials (ADC), service account key file via environment variable, service account key file via configuration parameter, and inline credentials.

### Application Default Credentials (ADC)

Authenticate using Application Default Credentials for local development:

```bash
gcloud auth application-default login
```

This creates credentials stored locally that your application can use automatically.

### Service Account Key File - Environment Variable

Create a service account and download the key file:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** > **Service Accounts**
3. Create a service account with **Secret Manager Secret Accessor** role
4. Generate and download a JSON key file

Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to the key file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Service Account Key File - Configuration Parameter

Alternatively, provide the key file path via the `--vault-keyFilename` parameter or `VAULT_KEYFILENAME` environment variable (see [Configuration](#configuration)).

### Inline Credentials

Provide credentials directly via configuration parameters (see [Configuration](#configuration)).

## Configuration

The GCP plugin supports 3 optional configuration parameters. If not set, it uses Application Default Credentials (ADC).

* `vault-projectId` - Sets the GCP project ID, e.g. `my-project-123456`
* `vault-keyFilename` - Sets the path to a service account key JSON file
* `vault-credentials` - Sets inline credentials (client_email, private_key, project_id)

**Note**: `projectId` is optional for client initialization. Secret IDs must use the full resource path format: `projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION`.

### Command Line Arguments

```json
{
  "mcpServers": {
    "myServer": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://github.com/astrix-security/mcp-secret-wrapper",
        "--vault-keyFilename=/path/to/service-account-key.json",
        "--vault-type=gcp",
        "--vault-projectId=my-project-123456",
        "API_KEY=projects/my-project-123456/secrets/my-api-key/versions/latest",
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
        "API_KEY=projects/my-project-123456/secrets/api-key/versions/latest",
        "--",
        "npx",
        "-y",
        "@org/mcp-server"
      ],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account-key.json",
        "VAULT_TYPE": "gcp",
        "VAULT_PROJECTID": "my-project-123456"
      }
    }
  }
}
```

## Secret Management

### Creating Secrets

#### Using gcloud CLI

```bash
# Create a simple string secret
echo -n "api_key_value_example" | gcloud secrets create mcp-api-key \
  --data-file=- \
  --project=my-project-123456

# Create a JSON secret
echo -n '{"apiKey": "api_key_value_example", "baseUrl": "https://api.example.com"}' | gcloud secrets create mcp-api-key \
  --data-file=- \
  --project=my-project-123456

# Add a secret version
echo -n "api_key_value_example" | gcloud secrets versions add mcp-api-key \
  --data-file=- \
  --project=my-project-123456
```

#### Using GCP Console

1. Go to Secret Manager in the Google Cloud Console
2. Click "Create Secret"
3. Enter your secret name
4. Enter your secret value (plaintext or JSON)
5. Configure replication and access permissions
6. Click "Create Secret"

### Secret Resource Names

GCP Secret Manager uses full resource names to identify secrets. You must provide the complete resource path:

```
projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION
```

Examples:
```
projects/my-project-123456/secrets/my-api-key/versions/latest
projects/my-project-123456/secrets/my-api-key/versions/1
```

**Note**: If you omit the `/versions/VERSION` part, the plugin will automatically append `/versions/latest` to use the latest version of the secret.

## Troubleshooting

### Common Issues

#### 1. Access Denied

```
Error: Permission denied on resource
```

**Solution**: Ensure your GCP credentials have the **Secret Manager Secret Accessor** role or necessary permissions.

#### 2. Secret Not Found

```
Error: Secret [SECRET_NAME] not found
```

**Solution**: Verify the full secret resource path (`projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION`) and that the secret exists in the specified project.

#### 3. Invalid Project ID

```
Error: The security token included in the request is invalid
```

**Solution**: Check that the projectId specified matches where your credentials are valid. Verify you're using the correct key file or credentials.

