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

  for (const [key, secretId] of Object.entries(envVars)) {
    try {
      result[key] = await vault.getSecret(secretId);
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
    
    let vaultConfig;
    try {
      vaultConfig = VaultConfigParser.getVaultConfig(args);
    } catch (error) {
      process.stderr.write(`Error parsing vault config: ${error instanceof Error ? error.message : String(error)}\n`);
      throw error;
    }

    // Remove vault-related arguments from args
    const cleanArgs = VaultConfigParser.removeVaultArgs(args);
    const [envVars, commandWithArgs] = parseCliArgs(cleanArgs);

    if (commandWithArgs.length === 0) {
      throw new Error(
        "No command specified. Use format: mcp-secret [ENV_VAR=secret_key...] -- command [args...]"
      );
    }

    const [command, ...commandArgs] = commandWithArgs;

    let vault;
    try {
      vault = await vaultRegistry.createVault(vaultConfig);
    } catch (error) {
      process.stderr.write(`Error creating vault: ${error instanceof Error ? error.message : String(error)}\n`);
      throw error;
    }
    
    let secretValues;
    try {
      secretValues = await getSecrets(envVars, vault);
    } catch (error) {
      process.stderr.write(`Error retrieving secrets: ${error instanceof Error ? error.message : String(error)}\n`);
      throw error;
    }

    runMcpServer(command, commandArgs, secretValues);
  } catch (error) {
    // Write to stderr explicitly to ensure errors are visible
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    const errorStack = error instanceof Error && error.stack
      ? `\n${error.stack}`
      : "";
    
    process.stderr.write(`mcp-secret-wrapper error: ${errorMessage}${errorStack}\n`);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Unhandled error: ${error instanceof Error ? error.message : String(error)}\n`);
    if (error instanceof Error && error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }
    process.exit(1);
  });
}

export { parseCliArgs, getSecrets, runMcpServer };
export default main;
