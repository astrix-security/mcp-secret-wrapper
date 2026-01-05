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
 * distributed under the License is distributed on "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { VaultPlugin } from "../types";
import * as fs from "fs";

export interface GCPVaultConfig {
  projectId?: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
    project_id: string;
  };
}

export class GCPVaultPlugin implements VaultPlugin {
  readonly name = "gcp";
  readonly version = "1.0.0";
  readonly description = "GCP Secret Manager vault implementation";
  readonly requiredParams: string[] = [];
  readonly optionalParams: string[] = [
    "projectId",
    "keyFilename",
    "credentials",
  ];

  private client?: SecretManagerServiceClient;
  private config?: GCPVaultConfig;

  async initialize(config: GCPVaultConfig): Promise<void> {
    this.config = config;

    const clientConfig: {
      projectId?: string;
      keyFilename?: string;
      credentials?: {
        client_email: string;
        private_key: string;
        project_id: string;
      };
    } = {};

    // Priority 1: Explicit keyFilename parameter
    if (config.keyFilename) {
      clientConfig.keyFilename = config.keyFilename;
      // Extract projectId from key file if not explicitly provided
      if (!config.projectId) {
        try {
          const keyFile = JSON.parse(
            fs.readFileSync(config.keyFilename, "utf8")
          );
          if (keyFile.project_id) {
            clientConfig.projectId = keyFile.project_id;
          }
        } catch (error) {
          throw new Error(
            `Failed to read or parse key file ${config.keyFilename}: ${error}`
          );
        }
      }
    }
    // Priority 2: GOOGLE_APPLICATION_CREDENTIALS environment variable
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      clientConfig.keyFilename = keyFilePath;
      // Extract projectId from key file if not explicitly provided
      if (!config.projectId) {
        try {
          const keyFile = JSON.parse(fs.readFileSync(keyFilePath, "utf8"));
          if (keyFile.project_id) {
            clientConfig.projectId = keyFile.project_id;
          }
        } catch (error) {
          throw new Error(
            `Failed to read or parse key file ${keyFilePath}: ${error}`
          );
        }
      }
    }
    // Priority 3: Inline credentials
    else if (config.credentials) {
      clientConfig.credentials = config.credentials;
      if (config.credentials.project_id) {
        clientConfig.projectId = config.credentials.project_id;
      }
    }
    // Priority 4: Application Default Credentials (ADC)
    // No explicit config needed - SDK will use ADC automatically

    // Explicit projectId takes precedence
    if (config.projectId) {
      clientConfig.projectId = config.projectId;
    }

    // Note: projectId is optional for client initialization
    // Secret IDs must use full path format: projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION
    this.client = new SecretManagerServiceClient(clientConfig);
  }

  async getSecret(secretId: string): Promise<string> {
    if (!this.client) {
      throw new Error(
        "GCP vault plugin not initialized. Call initialize() first."
      );
    }

    // Validate and normalize full path format
    if (!secretId.startsWith("projects/")) {
      throw new Error(
        `Invalid secret ID format: '${secretId}'. ` +
        `GCP Secret Manager requires full resource path format: ` +
        `projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION or ` +
        `projects/PROJECT_ID/secrets/SECRET_NAME/versions/latest`
      );
    }

    // Ensure it has /versions/ part, default to latest if missing
    let normalizedSecretId = secretId;
    if (!secretId.includes("/versions/")) {
      normalizedSecretId = `${secretId}/versions/latest`;
    }

    try {
      const [version] = await this.client.accessSecretVersion({
        name: normalizedSecretId,
      });

      if (!version.payload || !version.payload.data) {
        throw new Error("Secret value is empty");
      }

      // Convert secret data to string
      // version.payload.data can be string or Uint8Array
      const data = version.payload.data;
      if (typeof data === "string") {
        return data;
      } else {
        // It's a Uint8Array, convert to Buffer then to string
        return Buffer.from(data).toString("utf8");
      }
    } catch (error: unknown) {
      console.error(`Error retrieving secret ${secretId}:`, error);
      throw error;
    }
  }

  validateConfig(_config: Record<string, unknown>): boolean {
    // GCP Secret Manager doesn't require any specific parameters
    // All parameters are optional, but projectId must be resolvable
    return true;
  }

  getConfig(): GCPVaultConfig | undefined {
    return this.config;
  }
}

