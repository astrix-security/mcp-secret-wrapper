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

import { AzureVaultPlugin } from "../azure";

// Mock Azure SDK modules
jest.mock("@azure/keyvault-secrets", () => ({
  SecretClient: jest.fn().mockImplementation(() => ({
    getSecret: jest.fn(),
  })),
}));

jest.mock("@azure/identity", () => ({
  DefaultAzureCredential: jest.fn(),
  ClientSecretCredential: jest.fn(),
}));

import { SecretClient } from "@azure/keyvault-secrets";
import {
  DefaultAzureCredential,
  ClientSecretCredential,
} from "@azure/identity";

const MockedSecretClient = SecretClient as jest.MockedClass<
  typeof SecretClient
>;
const MockedDefaultAzureCredential = DefaultAzureCredential as jest.MockedClass<
  typeof DefaultAzureCredential
>;
const MockedClientSecretCredential = ClientSecretCredential as jest.MockedClass<
  typeof ClientSecretCredential
>;

describe("AzureVaultPlugin", () => {
  let plugin: AzureVaultPlugin;

  beforeEach(() => {
    plugin = new AzureVaultPlugin();
    jest.clearAllMocks();
  });

  describe("plugin metadata", () => {
    it("should have correct name", () => {
      expect(plugin.name).toBe("azure");
    });

    it("should have correct version", () => {
      expect(plugin.version).toBe("1.0.0");
    });

    it("should have a description", () => {
      expect(plugin.description).toBeTruthy();
    });

    it("should have empty requiredParams", () => {
      expect(plugin.requiredParams).toEqual([]);
    });

    it("should have expected optionalParams", () => {
      expect(plugin.optionalParams).toEqual(
        expect.arrayContaining([
          "vaultUrl",
          "vaultName",
          "tenantId",
          "clientId",
          "clientSecret",
        ]),
      );
    });
  });

  describe("validateConfig", () => {
    it("should always return true", () => {
      expect(plugin.validateConfig({})).toBe(true);
      expect(
        plugin.validateConfig({ vaultUrl: "https://x.vault.azure.net" }),
      ).toBe(true);
    });
  });

  describe("initialize", () => {
    it("should create SecretClient with vaultUrl and DefaultAzureCredential", async () => {
      await plugin.initialize({
        vaultUrl: "https://myvault.vault.azure.net",
      });

      expect(MockedDefaultAzureCredential).toHaveBeenCalledTimes(1);
      expect(MockedSecretClient).toHaveBeenCalledWith(
        "https://myvault.vault.azure.net",
        expect.any(Object),
      );
    });

    it("should build vault URL from vaultName", async () => {
      await plugin.initialize({ vaultName: "myvault" });

      expect(MockedSecretClient).toHaveBeenCalledWith(
        "https://myvault.vault.azure.net",
        expect.any(Object),
      );
    });

    it("should prefer vaultUrl over vaultName", async () => {
      await plugin.initialize({
        vaultUrl: "https://custom.vault.azure.net",
        vaultName: "ignored",
      });

      expect(MockedSecretClient).toHaveBeenCalledWith(
        "https://custom.vault.azure.net",
        expect.any(Object),
      );
    });

    it("should use ClientSecretCredential when all SP credentials are provided", async () => {
      await plugin.initialize({
        vaultUrl: "https://myvault.vault.azure.net",
        tenantId: "tenant-123",
        clientId: "client-456",
        clientSecret: "secret-789",
      });

      expect(MockedClientSecretCredential).toHaveBeenCalledWith(
        "tenant-123",
        "client-456",
        "secret-789",
      );
      expect(MockedDefaultAzureCredential).not.toHaveBeenCalled();
    });

    it("should use DefaultAzureCredential when SP credentials are incomplete", async () => {
      await plugin.initialize({
        vaultUrl: "https://myvault.vault.azure.net",
        tenantId: "tenant-123",
        // clientId and clientSecret missing
      });

      expect(MockedDefaultAzureCredential).toHaveBeenCalledTimes(1);
      expect(MockedClientSecretCredential).not.toHaveBeenCalled();
    });

    it("should fallback to AZURE_KEYVAULT_URL env var", async () => {
      const originalEnv = process.env.AZURE_KEYVAULT_URL;
      process.env.AZURE_KEYVAULT_URL = "https://envvault.vault.azure.net";

      try {
        await plugin.initialize({});

        expect(MockedSecretClient).toHaveBeenCalledWith(
          "https://envvault.vault.azure.net",
          expect.any(Object),
        );
      } finally {
        if (originalEnv === undefined) {
          delete process.env.AZURE_KEYVAULT_URL;
        } else {
          process.env.AZURE_KEYVAULT_URL = originalEnv;
        }
      }
    });

    it("should throw when no vault URL source is available", async () => {
      const originalEnv = process.env.AZURE_KEYVAULT_URL;
      delete process.env.AZURE_KEYVAULT_URL;

      try {
        await expect(plugin.initialize({})).rejects.toThrow(/vault URL/i);
      } finally {
        if (originalEnv !== undefined) {
          process.env.AZURE_KEYVAULT_URL = originalEnv;
        }
      }
    });

    it("should handle case-insensitive config keys (lowercase from env vars)", async () => {
      // When config comes from env vars, keys are lowercased by the config parser
      await plugin.initialize({
        vaulturl: "https://lowered.vault.azure.net",
      } as Record<string, unknown>);

      expect(MockedSecretClient).toHaveBeenCalledWith(
        "https://lowered.vault.azure.net",
        expect.any(Object),
      );
    });

    it("should handle case-insensitive SP credentials from env vars", async () => {
      await plugin.initialize({
        vaulturl: "https://myvault.vault.azure.net",
        tenantid: "tenant-123",
        clientid: "client-456",
        clientsecret: "secret-789",
      } as Record<string, unknown>);

      expect(MockedClientSecretCredential).toHaveBeenCalledWith(
        "tenant-123",
        "client-456",
        "secret-789",
      );
    });
  });

  describe("getSecret", () => {
    it("should throw when not initialized", async () => {
      await expect(plugin.getSecret("my-secret")).rejects.toThrow(
        /not initialized/i,
      );
    });

    it("should retrieve a secret by name", async () => {
      const mockGetSecret = jest.fn().mockResolvedValue({
        value: "my-secret-value",
      });
      MockedSecretClient.mockImplementation(
        () => ({ getSecret: mockGetSecret }) as any,
      );

      await plugin.initialize({
        vaultUrl: "https://myvault.vault.azure.net",
      });
      const result = await plugin.getSecret("my-secret");

      expect(mockGetSecret).toHaveBeenCalledWith("my-secret", {});
      expect(result).toBe("my-secret-value");
    });

    it("should retrieve a secret with a specific version", async () => {
      const mockGetSecret = jest.fn().mockResolvedValue({
        value: "versioned-value",
      });
      MockedSecretClient.mockImplementation(
        () => ({ getSecret: mockGetSecret }) as any,
      );

      await plugin.initialize({
        vaultUrl: "https://myvault.vault.azure.net",
      });
      const result = await plugin.getSecret("my-secret/abc123def456");

      expect(mockGetSecret).toHaveBeenCalledWith("my-secret", {
        version: "abc123def456",
      });
      expect(result).toBe("versioned-value");
    });

    it("should throw when secret value is empty", async () => {
      const mockGetSecret = jest.fn().mockResolvedValue({
        value: undefined,
      });
      MockedSecretClient.mockImplementation(
        () => ({ getSecret: mockGetSecret }) as any,
      );

      await plugin.initialize({
        vaultUrl: "https://myvault.vault.azure.net",
      });

      await expect(plugin.getSecret("empty-secret")).rejects.toThrow(/empty/i);
    });

    it("should propagate SDK errors", async () => {
      const sdkError = new Error("Access denied");
      const mockGetSecret = jest.fn().mockRejectedValue(sdkError);
      MockedSecretClient.mockImplementation(
        () => ({ getSecret: mockGetSecret }) as any,
      );

      await plugin.initialize({
        vaultUrl: "https://myvault.vault.azure.net",
      });

      await expect(plugin.getSecret("forbidden")).rejects.toThrow(
        "Access denied",
      );
    });
  });

  describe("getConfig", () => {
    it("should return undefined before initialization", () => {
      expect(plugin.getConfig()).toBeUndefined();
    });

    it("should return stored config after initialization", async () => {
      const config = { vaultUrl: "https://myvault.vault.azure.net" };
      await plugin.initialize(config);

      expect(plugin.getConfig()).toEqual(config);
    });
  });
});
