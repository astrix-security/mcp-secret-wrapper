#!/usr/bin/env node

/*
 * Copyright 2025 Astrix Security
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { spawn } from "child_process";
import {
  VaultPlugin,
  vaultRegistry,
  VaultConfigParser,
  AWSVaultPlugin,
  GCPVaultPlugin,
} from "./vaults";

/**
 * Parse command line arguments into env vars and command
 * @param args Command line arguments
 * @returns Tuple of environment variables and command with args
 */
function parseCliArgs(args: string[]): [Record<string, string>, string[]] {
  const envVars: Record<string, string> = {};
  let command: string[] = [];

  const delimiterIndex = args.indexOf("--");

  if (delimiterIndex !== -1) {
    const envVarArgs = args.slice(0, delimiterIndex);
    command = args.slice(delimiterIndex + 1);

    for (const arg of envVarArgs) {
      if (!arg.includes("=")) {
        throw new Error(`Invalid format: '${arg}'. Use key=value.`);
      }

      const [key, value] = arg.split("=", 2);
      envVars[key] = value;
    }
  } else {
    command = args;
  }

  return [envVars, command];
}

/**
 * Run the MCP server with secrets injected as environment variables
 * @param command Command to run
 * @param args Command arguments
 * @param env Environment variables
 */
function runMcpServer(
  command: string,
  args: string[],
  env: Record<string, string>
): void {
  const childProcess = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: true,
  });

  childProcess.on("error", (error) => {
    console.error(`Error executing command: ${error.message}`);
    process.exit(1);
  });

  childProcess.on("exit", (code) => {
    process.exit(code || 0);
  });
}

/**
 * Validate JSON path format
 * @param jsonPath The JSON path to validate
 * @throws Error if path format is invalid
 */
function validateJsonPath(jsonPath: string): void {
  if (jsonPath.length === 0) {
    throw new Error("JSON path cannot be empty");
  }

  if (jsonPath.startsWith(".") || jsonPath.endsWith(".")) {
    throw new Error(
      `JSON path '${jsonPath}' cannot start or end with a dot. Use format like 'key.subkey'`
    );
  }

  const segments = jsonPath.split(".");
  const emptySegments = segments.filter((seg) => seg.length === 0);
  if (emptySegments.length > 0) {
    throw new Error(
      `JSON path '${jsonPath}' contains empty segments. Use format like 'key.subkey' without consecutive dots`
    );
  }
}

/**
 * Extract a value from a JSON string using dot-notation path
 * @param jsonString The JSON string to parse
 * @param jsonPath Dot-notation path (e.g., "credentials.password")
 * @returns The extracted value as a string
 * @throws Error if JSON is invalid, path doesn't exist, or value is not a primitive
 */
function extractJsonPath(jsonString: string, jsonPath: string): string {
  // Validate path format first
  validateJsonPath(jsonPath);

  // 1. Try to parse as JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // The user requested JSON path extraction (by including #), but secret isn't JSON
      throw new Error(
        `Cannot extract JSON path '${jsonPath}' from secret: secret value is not valid JSON. ` +
        `If you did not intend to extract a JSON path, remove the '#${jsonPath}' suffix from the secret ID.`
      );
    }
    throw error;
  }

  // 2. Validate it's a plain object (not an array, not a primitive)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const valueType = Array.isArray(parsed)
      ? "a JSON array"
      : parsed === null
        ? "null"
        : `a JSON primitive (${typeof parsed})`;
    throw new Error(
      `Cannot extract JSON path '${jsonPath}' from secret: secret value is ${valueType}, not a JSON object. ` +
      `JSON path extraction requires a JSON object with key-value pairs.`
    );
  }

  // 3. Traverse the path using dot notation
  const keys = jsonPath.split(".");
  let value: unknown = parsed;
  const pathSegments: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const parentPath = pathSegments.length > 0 ? pathSegments.join(".") : null;

    // Ensure current value is a plain object (not array, not null, not primitive)
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      const pathDescription = parentPath
        ? `path '${parentPath}'`
        : "top-level";
      const valueType = Array.isArray(value)
        ? "an array"
        : value === null
          ? "null"
          : `a ${typeof value}`;
      throw new Error(
        `Cannot extract JSON path '${jsonPath}' from secret: value at ${pathDescription} is ${valueType}, not a plain object. ` +
        `Cannot access property '${key}' on ${valueType}. JSON path extraction requires plain objects with key-value pairs.`
      );
    }

    // Access the property
    if (key in value) {
      value = (value as Record<string, unknown>)[key];
      pathSegments.push(key);
    } else {
      // Provide context-appropriate error message
      const availableKeys = Object.keys(value as Record<string, unknown>);
      const pathDescription = parentPath
        ? `path '${parentPath}'`
        : "top-level";
      throw new Error(
        `Cannot extract JSON path '${jsonPath}' from secret: key '${key}' not found at ${pathDescription}. ` +
        `Available keys: ${availableKeys.length > 0 ? availableKeys.join(", ") : "(none)"}`
      );
    }
  }

  // 4. Convert final value to string
  if (typeof value === "string") {
    return value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  } else if (value === null) {
    throw new Error(
      `Cannot extract JSON path '${jsonPath}' from secret: value at path '${jsonPath}' is null. ` +
      `Only non-null primitive values (string, number, boolean) can be extracted.`
    );
  } else if (Array.isArray(value)) {
    throw new Error(
      `Cannot extract JSON path '${jsonPath}' from secret: value at path '${jsonPath}' is an array. ` +
      `Only primitive values (string, number, boolean) can be extracted, not arrays or objects.`
    );
  } else {
    throw new Error(
      `Cannot extract JSON path '${jsonPath}' from secret: value at path '${jsonPath}' is an object. ` +
      `Only primitive values (string, number, boolean) can be extracted, not objects or arrays.`
    );
  }
}

/**
 * Get secrets from vault
 * @param envVars Environment variables mapping to secret keys
 * @param vault Vault plugin instance
 * @returns Promise resolving to environment variables with secrets
 */
async function getSecrets(
  envVars: Record<string, string>,
  vault: VaultPlugin
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const [key, secretIdWithPath] of Object.entries(envVars)) {
    try {
      // Parse secretId to separate actual secret ID from JSON path
      // Split on the LAST # to handle edge cases where # might appear in secret ID
      const lastHashIndex = secretIdWithPath.lastIndexOf("#");
      const actualSecretId =
        lastHashIndex === -1
          ? secretIdWithPath
          : secretIdWithPath.substring(0, lastHashIndex);
      const jsonPath =
        lastHashIndex === -1
          ? undefined
          : secretIdWithPath.substring(lastHashIndex + 1);

      // Validate jsonPath if present
      if (jsonPath !== undefined && jsonPath.length === 0) {
        throw new Error(
          `Invalid secret ID format for ${key}: '${secretIdWithPath}'. ` +
          `JSON path cannot be empty after '#' delimiter.`
        );
      }

      // Fetch secret from vault (plugin doesn't know about JSON paths)
      const secretValue = await vault.getSecret(actualSecretId);

      // If JSON path specified, extract the value; otherwise use full secret
      result[key] = jsonPath
        ? extractJsonPath(secretValue, jsonPath)
        : secretValue;
    } catch (error) {
      console.error(`Failed to get secret for ${key}:`, error);
      throw error;
    }
  }

  return result;
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  try {
    vaultRegistry.register(new AWSVaultPlugin());
    vaultRegistry.register(new GCPVaultPlugin());

    // Skip the first two arguments (node and script path)
    const args = process.argv.slice(2);
    const vaultConfig = VaultConfigParser.getVaultConfig(args);

    // Remove vault-related arguments from args
    const cleanArgs = VaultConfigParser.removeVaultArgs(args);
    const [envVars, commandWithArgs] = parseCliArgs(cleanArgs);

    if (commandWithArgs.length === 0) {
      throw new Error(
        "No command specified. Use format: mcp-secret [ENV_VAR=secret_key...] -- command [args...]"
      );
    }

    const [command, ...commandArgs] = commandWithArgs;

    const vault = await vaultRegistry.createVault(vaultConfig);
    const secretValues = await getSecrets(envVars, vault);

    runMcpServer(command, commandArgs, secretValues);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main();
}

export { parseCliArgs, getSecrets, runMcpServer };
export default main;
