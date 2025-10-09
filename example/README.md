# MCP Secret Wrapper Behind-The-Scenes MCP Server

This folder contains an example MCP server that demonstrates how to use the MCP Secret Wrapper tool and what happens behind-the-scenes.

## Example MCP Server

The `mcp-server.ts` is a simple TypeScript MCP server that:

- Requires one environment variable: `API_KEY`
- Provides two tools: `get_secret_info` and `validate_secret`
- Validates that the API key is properly injected before starting

## Setup

### 1. Install Dependencies

```bash
cd example
npm install
```

### 2. Build the Server

```bash
npm run build
```

## Usage Methods

### Method 1: Direct Secrets in MCP Configuration File

The server receives its secret through the MCP configuration file. Add this to your MCP configuration:

```json
{
  "mcpServers": {
    "example-server-direct": {
      "command": "node",
      "args": ["/path/to/example/dist/mcp-server.js"],
      "env": {
        "API_KEY": "sk-1234567890abcdef1234567890abcdef"
      }
    }
  }
}
```

The server will automatically receive the `API_KEY` as an environment variable from this configuration.

### Method 2: Using AWS Secrets Manager

#### Step 1: Create Secrets in AWS Secrets Manager

```bash
# Create API Key secret
aws secretsmanager create-secret \
  --name "example-mcp/api-key" \
  --description "API Key for example MCP server" \
  --secret-string "sk-1234567890abcdef1234567890abcdef"
```

#### Step 2: Configure MCP Server

```json
{
  "mcpServers": {
    "example-server-secure": {
      "command": "npx",
      "args": [
        "git+https://github.com/astrix-security/mcp-secret-wrapper",
        "--vault-type=aws",
        "--vault-region=us-east-1",
        "API_KEY=arn:aws:secretsmanager:us-east-1:123456789012:secret:example-mcp/api-key",
        "--",
        "node",
        "/path/to/example/dist/mcp-server.js"
      ]
    }
  }
}
```

**Note:** Replace `/path/to/example/dist/mcp-server.js` with the actual path to your built server.

**Important:** You must specify `--vault-type` in the arguments.

## Testing the Server

Once connected to your favorite MCP client, you can test the server by asking the AI Agent to use the available tools:

### Available Tools

1. **get_secret_info** - Shows information about the configured API key
2. **validate_secret** - Validates that the API key matches an expected value

### Example Interactions

- "Use the get_secret_info tool to show me the secret information"
- "Validate the API key using the validate_secret tool with value 'sk-1234567890abcdef1234567890abcdef'"
