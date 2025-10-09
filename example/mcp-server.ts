#!/usr/bin/env node

/**
 * Simple MCP Server Example
 * This server demonstrates how to use secrets from environment variables
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

interface SecretInfo {
  apiKey: string;
}

class ExampleMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: "example-mcp-server",
      version: "1.0.0",
    });

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: "get_secret_info",
          description: "Get information about the configured secret",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "validate_secret",
          description: "Validate that the secret is properly configured",
          inputSchema: {
            type: "object",
            properties: {
              expected_value: {
                type: "string",
                description: "Expected secret value to validate against",
              },
            },
            required: ["expected_value"],
          },
        },
      ];

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "get_secret_info":
          return await this.getSecretInfo();
        case "validate_secret":
          return await this.validateSecret(args?.expected_value as string);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async getSecretInfo(): Promise<CallToolResult> {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      throw new Error("API_KEY environment variable is not set");
    }

    const secretInfo: SecretInfo = {
      apiKey: `${apiKey.substring(0, 8)}... (${apiKey.length} characters)`,
    };

    return {
      content: [
        {
          type: "text",
          text: `Secret Information:
- API Key: ${secretInfo.apiKey}`,
        },
      ],
      isError: false,
    };
  }

  private async validateSecret(expectedValue: string): Promise<CallToolResult> {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      throw new Error("API_KEY environment variable is not set");
    }

    const isValid = apiKey === expectedValue;

    return {
      content: [
        {
          type: "text",
          text: `Secret Validation:
- Expected: ${expectedValue}
- Actual: ${apiKey}
- Valid: ${isValid ? "✅ Yes" : "❌ No"}`,
        },
      ],
      isError: false,
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Example MCP Server running on stdio");
  }
}

// Check if secrets are available
const requiredSecrets = ["API_KEY"];
const missingSecrets = requiredSecrets.filter((secret) => !process.env[secret]);

if (missingSecrets.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingSecrets.join(", ")}`
  );
  console.error(
    "Please ensure these secrets are injected via the mcp-secret-wrapper tool"
  );
  process.exit(1);
}

// Start the server
const server = new ExampleMCPServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
