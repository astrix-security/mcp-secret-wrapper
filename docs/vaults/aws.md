# AWS Secret Smanager Vault

This guide covers how to use MCP Secret Wrapper with AWS Secrets Manager to securely inject secrets into your MCP servers.

## Overview

Using MCP Secret Wrapper, you can securely retrieve secrets from AWS Secrets Manager and inject them as environment variables into your MCP servers.

## Prerequisites

- AWS account with Secrets Manager access
- AWS credentials configured (see [Authentication](#authentication))
- Node.js installed

## Authentication

MCP Secret Wrapper supports 2 AWS authentication methods: AWS Access Key and temporary AWS STS Session based on AWS CLI credentials.

### AWS CLI Configuration - Access Key

Configure your AWS credentials using the AWS CLI:

```bash
aws configure --profile aws-profile
```

This creates credentials in `~/.aws/credentials` and configuration in `~/.aws/config`.

### AWS CLI Configuration - Temporary Session

Use `aws sts assume-role` commands or `aws sts get-session-token` and inject the resulting credentials into your `~/.aws/credentials` under a new profile.

## Configuration

The AWS plugin supports 5 optional configuration parameters. If not set, it uses the credentials configured for the default AWS profile.

* `vault-profile` - Sets the CLI profile used
* `vault-region` - Sets the AWS region, e.g. `us-east-1`
* `vault-accessKeyId` - Sets a static access key ID
* `vault-secretAccessKey` - Sets a static access key secret 
* `vault-sessionToken` - Sets a static session token

### Command Line Arguments

```json
{
  "mcpServers": {
    "myServer": {
      "command": "npx",
      "args": [
        "-y",
        "git+https://github.com/astrix-security/mcp-secret-wrapper", // TODO - Change
        "--vault-profile=aws-profile",
        "--vault-type=aws",
        "--vault-region=us-east-1",
        "API_KEY=arn:aws:secretsmanager:us-east-1:123456789012:secret:my-api-key",
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
        "git+https://github.com/astrix-security/mcp-secret-wrapper", // TODO - Change
        "API_KEY=arn:aws:secretsmanager:us-east-1:123456789012:secret:api-key",
        "--",
        "npx",
        "-y",
        "@org/mcp-server"
      ],
      "env": {
        "VAULT_PROFILE": "aws-profile",
        "VAULT_TYPE": "aws",
        "VAULT_REGION": "us-east-1"
      }
    }
  }
}
```

## Secret Management

### Creating Secrets

#### Using AWS CLI

```bash
# Create a simple string secret
aws secretsmanager create-secret \
--name mcp-api-key \
--secret-string 'api_key_value_example'

# Create a JSON secret
aws secretsmanager create-secret \
--name mcp-api-key \
--secret-string '{"apiKey": "api_key_value_example", "baseUrl": "https://api.example.com"}'
```

#### Using AWS Console

1. Go to AWS Secrets Manager in the AWS Console
2. Click "Store a new secret"
3. Choose "Other type of secret"
4. Enter your secret data (key-value pairs or plaintext)
5. Configure encryption and access permissions
6. Give your secret a name and description

### Secret ARNs

AWS Secrets Manager uses ARNs (Amazon Resource Names) to identify secrets:

```
arn:aws:secretsmanager:region:account-id:secret:secret-name
```

Example:
```
arn:aws:secretsmanager:us-east-1:123456789012:secret:my-app/api-key-ABC123
```

## Troubleshooting

### Common Issues

#### 1. Access Denied

```
Error: User is not authorized to perform: secretsmanager:GetSecretValue
```

**Solution**: Ensure your AWS credentials have the necessary permissions.

#### 2. Secret Not Found

```
Error: Secrets Manager can't find the specified secret
```

**Solution**: Verify the secret ARN and that the secret exists in the specified region.

#### 3. Invalid Region

```
Error: The security token included in the request is invalid
```

**Solution**: Check that the region specified matches where your credentials are valid. Verify you're usig the correct profile.