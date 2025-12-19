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
import { execSync } from "child_process";

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
  private resolvedProjectId?: string;

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
            this.resolvedProjectId = keyFile.project_id;
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
            this.resolvedProjectId = keyFile.project_id;
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
        this.resolvedProjectId = config.credentials.project_id;
        clientConfig.projectId = config.credentials.project_id;
      }
    }
    // Priority 4: Application Default Credentials (ADC)
    // No explicit config needed - SDK will use ADC automatically

    // Explicit projectId takes precedence
    if (config.projectId) {
      this.resolvedProjectId = config.projectId;
      clientConfig.projectId = config.projectId;
    }

    // Validate that we have a projectId (required for secret access)
    if (!this.resolvedProjectId && !clientConfig.projectId) {
      // Try to get from gcloud config as last resort
      try {
        const projectId = execSync("gcloud config get-value project", {
          encoding: "utf8",
        }).trim();
        if (projectId && projectId !== "(unset)") {
          this.resolvedProjectId = projectId;
          clientConfig.projectId = projectId;
        }
      } catch (error) {
        // Ignore errors from gcloud command
      }

      if (!this.resolvedProjectId && !clientConfig.projectId) {
        throw new Error(
          "GCP projectId is required. Provide it via --vault-projectId, VAULT_PROJECTID, keyFilename, credentials, or gcloud config."
        );
      }
    }

    this.client = new SecretManagerServiceClient(clientConfig);
  }

  async getSecret(secretId: string): Promise<string> {
    if (!this.client) {
      throw new Error(
        "GCP vault plugin not initialized. Call initialize() first."
      );
    }

    // Normalize secret ID format
    let normalizedSecretId = secretId;

    // If shorthand format (projectId/secretName or projectId/secretName/version)
    if (!secretId.startsWith("projects/")) {
      if (!this.resolvedProjectId) {
        throw new Error(
          "Cannot use shorthand secret ID format without projectId. Use full format: projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION"
        );
      }

      const parts = secretId.split("/");
      if (parts.length === 1) {
        // Just secret name, default to latest version
        normalizedSecretId = `projects/${this.resolvedProjectId}/secrets/${parts[0]}/versions/latest`;
      } else if (parts.length === 2) {
        // projectId/secretName or secretName/version
        // Check if first part matches projectId
        if (parts[0] === this.resolvedProjectId) {
          normalizedSecretId = `projects/${parts[0]}/secrets/${parts[1]}/versions/latest`;
        } else {
          // Assume it's secretName/version
          normalizedSecretId = `projects/${this.resolvedProjectId}/secrets/${parts[0]}/versions/${parts[1]}`;
        }
      } else if (parts.length === 3) {
        // projectId/secretName/version
        normalizedSecretId = `projects/${parts[0]}/secrets/${parts[1]}/versions/${parts[2]}`;
      } else {
        throw new Error(
          `Invalid secret ID format: ${secretId}. Use format: projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION or PROJECT_ID/SECRET_NAME`
        );
      }
    } else {
      // Full format provided, but ensure it has /versions/ part
      if (!secretId.includes("/versions/")) {
        // Add /versions/latest if not specified
        normalizedSecretId = `${secretId}/versions/latest`;
      }
    }

    try {
      const [version] = await this.client.accessSecretVersion({
        name: normalizedSecretId,
      });

      if (!version.payload || !version.payload.data) {
        throw new Error("Secret value is empty");
      }

      // Convert secret data to string
      const secretValue = version.payload.data.toString("utf8");
      return secretValue;
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
