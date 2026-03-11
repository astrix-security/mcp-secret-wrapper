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

import { SecretClient } from "@azure/keyvault-secrets";
import {
  DefaultAzureCredential,
  ClientSecretCredential,
} from "@azure/identity";
import { VaultPlugin } from "../types";

export interface AzureVaultConfig {
  vaultUrl?: string;
  vaultName?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * Case-insensitive config value lookup.
 * Handles the mismatch between env var keys (lowercased by config parser)
 * and CLI arg keys (camelCase preserved).
 */
function getConfigValue(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const lowerKey = key.toLowerCase();
  const entry = Object.entries(config).find(
    ([k]) => k.toLowerCase() === lowerKey,
  );
  return entry ? String(entry[1]) : undefined;
}

export class AzureVaultPlugin implements VaultPlugin {
  readonly name = "azure";
  readonly version = "1.0.0";
  readonly description = "Azure Key Vault implementation";
  readonly requiredParams: string[] = [];
  readonly optionalParams: string[] = [
    "vaultUrl",
    "vaultName",
    "tenantId",
    "clientId",
    "clientSecret",
  ];

  private client?: SecretClient;
  private config?: AzureVaultConfig;

  async initialize(config: AzureVaultConfig): Promise<void> {
    this.config = config;

    const rawConfig = config as Record<string, unknown>;

    // Resolve vault URL with fallback chain:
    // 1. vaultUrl param  2. vaultName param  3. AZURE_KEYVAULT_URL env var
    const vaultUrl = getConfigValue(rawConfig, "vaultUrl");
    const vaultName = getConfigValue(rawConfig, "vaultName");

    let resolvedUrl: string;
    if (vaultUrl) {
      resolvedUrl = vaultUrl;
    } else if (vaultName) {
      resolvedUrl = `https://${vaultName}.vault.azure.net`;
    } else if (process.env.AZURE_KEYVAULT_URL) {
      resolvedUrl = process.env.AZURE_KEYVAULT_URL;
    } else {
      throw new Error(
        "Azure Key Vault URL is required. Provide --vault-vaultUrl, --vault-vaultName, or set AZURE_KEYVAULT_URL environment variable.",
      );
    }

    // Resolve credential
    const tenantId = getConfigValue(rawConfig, "tenantId");
    const clientId = getConfigValue(rawConfig, "clientId");
    const clientSecretValue = getConfigValue(rawConfig, "clientSecret");

    const credential =
      tenantId && clientId && clientSecretValue
        ? new ClientSecretCredential(tenantId, clientId, clientSecretValue)
        : new DefaultAzureCredential();

    this.client = new SecretClient(resolvedUrl, credential);
  }

  async getSecret(secretId: string): Promise<string> {
    if (!this.client) {
      throw new Error(
        "Azure vault plugin not initialized. Call initialize() first.",
      );
    }

    try {
      // Parse optional version: "secret-name/version-guid"
      const slashIndex = secretId.indexOf("/");
      const name =
        slashIndex === -1 ? secretId : secretId.substring(0, slashIndex);
      const version =
        slashIndex === -1 ? undefined : secretId.substring(slashIndex + 1);

      const secret = await this.client.getSecret(name, {
        ...(version && { version }),
      });

      if (!secret.value) {
        throw new Error("Secret value is empty");
      }

      return secret.value;
    } catch (error: unknown) {
      console.error(`Error retrieving secret ${secretId}:`, error);
      throw error;
    }
  }

  validateConfig(_config: Record<string, unknown>): boolean {
    // Azure Key Vault doesn't require any specific parameters
    // All parameters are optional with fallback chain
    return true;
  }

  getConfig(): AzureVaultConfig | undefined {
    return this.config;
  }
}
