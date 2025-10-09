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

import { VaultConfig } from "./types";

/**
 * Parse vault configuration from CLI arguments and environment variables
 */
export class VaultConfigParser {
  static parseFromArgs(args: string[]): VaultConfig | null {
    const vaultTypeArg = args.find((arg) => arg.startsWith("--vault-type="));
    if (!vaultTypeArg) {
      return null;
    }

    const vaultType = vaultTypeArg.split("=")[1];
    const params: Record<string, unknown> = {};

    for (const arg of args) {
      if (arg.startsWith("--vault-") && !arg.startsWith("--vault-type=")) {
        const [key, value] = arg.substring(8).split("=");
        if (key && value) {
          params[key] = value;
        }
      }
    }

    return {
      type: vaultType,
      params,
    };
  }

  /**
   * Parse vault configuration from environment variables
   * Expected format: VAULT_TYPE=aws VAULT_PROFILE=dev VAULT_REGION=us-east-1
   */
  static parseFromEnv(): VaultConfig | null {
    const vaultType = process.env.VAULT_TYPE;
    if (!vaultType) {
      return null;
    }

    const params: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("VAULT_") && key !== "VAULT_TYPE") {
        const paramKey = key.substring(6).toLowerCase();
        params[paramKey] = value;
      }
    }

    return {
      type: vaultType,
      params,
    };
  }

  /**
   * Get vault configuration with fallback priority:
   * 1. CLI arguments
   * 2. Environment variables
   * 3. Throw error if no configuration found
   */
  static getVaultConfig(args: string[]): VaultConfig {
    const cliConfig = this.parseFromArgs(args);
    if (cliConfig) {
      return cliConfig;
    }

    const envConfig = this.parseFromEnv();
    if (envConfig) {
      return envConfig;
    }

    throw new Error(
      "No vault configuration found. Please specify --vault-type or set VAULT_TYPE environment variable."
    );
  }

  static removeVaultArgs(args: string[]): string[] {
    return args.filter((arg) => !arg.startsWith("--vault-"));
  }
}
