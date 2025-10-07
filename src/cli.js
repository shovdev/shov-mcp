#!/usr/bin/env node

import { ShovMCPServer } from './index.js';

/**
 * CLI for shov-mcp
 * Usage: shov-mcp <domain> --api-key <key>
 */

function printUsage() {
  console.error(`
Usage: shov-mcp <domain> [options]

Arguments:
  domain              Your Shov project domain (e.g., myapp_acme.shov.dev)

Options:
  --api-key <key>     API key for authentication (or set SHOV_API_KEY env var)
  --help              Show this help message

Examples:
  shov-mcp myapp_acme.shov.dev --api-key pk_abc123
  shov-mcp api.yourdomain.com --api-key pk_abc123
  SHOV_API_KEY=pk_abc123 shov-mcp myapp_acme.shov.dev
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Parse arguments
  const domain = args[0];
  const apiKeyIndex = args.indexOf('--api-key');
  const apiKey = apiKeyIndex !== -1 ? args[apiKeyIndex + 1] : process.env.SHOV_API_KEY;

  // Validate arguments
  if (!domain) {
    console.error('Error: Domain is required\n');
    printUsage();
    process.exit(1);
  }

  if (!apiKey) {
    console.error('Error: API key is required (use --api-key or set SHOV_API_KEY env var)\n');
    printUsage();
    process.exit(1);
  }

  // Validate API key format
  if (!apiKey.startsWith('pk_')) {
    console.error('Warning: API key should start with "pk_" (project key)');
  }

  try {
    // Create and start server
    const server = new ShovMCPServer(domain, apiKey);
    await server.start();
  } catch (error) {
    console.error(`\nError: ${error.message}\n`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
