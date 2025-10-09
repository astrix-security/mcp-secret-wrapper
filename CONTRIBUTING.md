# Contributing to the MCP Secret Wrapper Project

Thank you for your interest in contributing to MCP Secret Wrapper! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Adding New Vault Support](#adding-new-vault-support)
- [Reporting Issues](#reporting-issues)
- [Questions?](#questions)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful, inclusive, and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-secret-wrapper.git
   cd mcp-secret-wrapper
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/astrix-security/mcp-secret-wrapper.git
   ```

## Development Setup

### Prerequisites

- Node.js 14+ 
- npm
- Git

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### Available Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Run in development mode with ts-node
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Making Changes

### Branch Strategy

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards:
   - Use TypeScript for all new code
   - Follow existing code style and patterns
   - Add JSDoc comments for public APIs
   - Keep functions small and focused

3. **Test your changes & run linter**

### Coding Standards

- **TypeScript**: Use TypeScript for all new code
- **ESLint**: Follow the project's ESLint configuration
- **Prettier**: Use Prettier for code formatting
- **Naming**: Use descriptive names for variables and functions
- **Comments**: Add comments for complex logic
- **Error Handling**: Always handle errors appropriately

## Submitting Changes

### Pull Request Process

1. **Ensure your branch is up to date**:
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/your-feature-name
   git rebase main
   ```

2. **Push your changes**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub with:
   - Clear title and description
   - Reference any related issues
   - Include screenshots if applicable
   - List any breaking changes

## Adding New Vault Support

To add support for a new secrets vault:

### 1. Create the Plugin

Create a new file in `src/vaults/plugins/your-vault.ts`:

```typescript
import { VaultPlugin } from "../types";

export interface YourVaultConfig {
  // Define configuration interface
}

export class YourVaultPlugin implements VaultPlugin {
  readonly name = "your-vault";
  readonly version = "1.0.0";
  readonly description = "Your vault implementation";
  readonly requiredParams: string[] = [];
  readonly optionalParams: string[] = [];

  async initialize(config: YourVaultConfig): Promise<void> {
    // Initialize your vault client
  }

  async getSecret(secretId: string): Promise<string> {
    // Implement secret retrieval
  }

  validateConfig(config: Record<string, unknown>): boolean {
    // Validate configuration
  }

  getConfig(): YourVaultConfig | undefined {
    // Return current configuration
  }
}
```

### 2. Register the Plugin

Add your plugin to the registry in `src/vaults/registry.ts`:

```typescript
import { YourVaultPlugin } from "./plugins/your-vault";

// In the constructor or initialization
this.register(new YourVaultPlugin());
```

### 3. Update Documentation

- Update the support table in `README.md`
- Add usage examples in the `example` directory
- Document configuration options in `docs` directory 

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Environment**: OS, Node.js version, npm version
- **Steps to reproduce**: Clear, numbered steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Error messages**: Full error output
- **Screenshots**: If applicable

### Feature Requests

For feature requests, please include:

- **Use case**: Why is this feature needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Other solutions you've considered
- **Additional context**: Any other relevant information

## Questions?

- **GitHub Discussions**: For general questions and discussions
- **GitHub Issues**: For bug reports and feature requests
- **Email**: For any further issues, email info@astrix-security.com

## Recognition

Contributors will be recognized in:
- The project's README.md
- Release notes for significant contributions
- GitHub's contributor graph

Thank you for contributing to MCP Secret Wrapper! 🎉
