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

    // Try to get from gcloud config as last resort (but don't require it yet)
    if (!this.resolvedProjectId && !clientConfig.projectId) {
      try {
        const projectId = execSync("gcloud config get-value project", {
          encoding: "utf8",
        }).trim();
        if (projectId && projectId !== "(unset)") {
          this.resolvedProjectId = projectId;
          clientConfig.projectId = projectId;
        }
      } catch (error) {
        // Ignore errors from gcloud command - projectId can be extracted from secret ID later
      }
    }

    // Note: projectId is not strictly required for client initialization
    // It can be extracted from secret ID format in getSecret() if needed
    try {
      this.client = new SecretManagerServiceClient(clientConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize GCP Secret Manager client: ${errorMessage}. Ensure GCP credentials are configured via GOOGLE_APPLICATION_CREDENTIALS, --vault-keyFilename, or gcloud auth application-default login.`
      );
    }
  }

  async getSecret(secretId: string): Promise<string> {
    if (!this.client) {
      throw new Error(
        "GCP vault plugin not initialized. Call initialize() first."
      );
    }

    // Normalize secret ID format
    let normalizedSecretId = secretId;

    // If full format (projects/PROJECT_ID/secrets/...), extract projectId if not already set
    if (secretId.startsWith("projects/")) {
      const parts = secretId.split("/");
      if (parts.length >= 2 && parts[0] === "projects" && !this.resolvedProjectId) {
        // Extract projectId from secret ID format
        this.resolvedProjectId = parts[1];
      }
      
      // Ensure it has /versions/ part
      if (!secretId.includes("/versions/")) {
        // Add /versions/latest if not specified
        normalizedSecretId = `${secretId}/versions/latest`;
      } else {
        normalizedSecretId = secretId;
      }
    } else {
      // Shorthand format (projectId/secretName or projectId/secretName/version)
      if (!this.resolvedProjectId) {
        throw new Error(
          "Cannot use shorthand secret ID format without projectId. Use full format: projects/PROJECT_ID/secrets/SECRET_NAME/versions/VERSION or set projectId via --vault-projectId, VAULT_PROJECTID, keyFilename, credentials, or gcloud config."
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
    }

    try {
      const [version] = await this.client.accessSecretVersion({
        name: normalizedSecretId,
      });

      if (!version.payload || !version.payload.data) {
        throw new Error("Secret value is empty");
      }

      // Convert secret data to string
      // version.payload.data is a Uint8Array, so convert to Buffer first
      const secretValue = Buffer.from(version.payload.data).toString("utf8");
      return secretValue;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error retrieving secret ${secretId} (normalized: ${normalizedSecretId}):`, errorMessage);
      
      // Provide more helpful error messages
      if (errorMessage.includes("Permission denied") || errorMessage.includes("permission")) {
        throw new Error(
          `Permission denied accessing secret. Ensure your GCP credentials have the 'Secret Manager Secret Accessor' role. Original error: ${errorMessage}`
        );
      } else if (errorMessage.includes("not found") || errorMessage.includes("NotFound")) {
        throw new Error(
          `Secret not found: ${normalizedSecretId}. Verify the secret exists in the specified project. Original error: ${errorMessage}`
        );
      } else if (errorMessage.includes("Could not load the default credentials")) {
        throw new Error(
          `GCP credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS, use --vault-keyFilename, or run 'gcloud auth application-default login'. Original error: ${errorMessage}`
        );
      }
      
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

