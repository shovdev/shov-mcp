# shov-mcp

Universal MCP (Model Context Protocol) client for Shov. Connect AI assistants to:

1. **Shov Platform API** (`shov.com/api`) - Create/manage projects, deploy code, manage data
2. **User-built Shov APIs** (`yourapp.shov.dev`) - Connect to any Shov project's custom API

## Installation

```bash
npm install -g shov-mcp
```

## Usage

### 1. Connect AI to Shov Platform (Control Plane)

Give AI assistants full control of Shov infrastructure - perfect for AI agents that build and deploy apps:

**Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "shov-platform": {
      "command": "npx",
      "args": ["-y", "shov-mcp", "shov.com", "--api-key", "shov_live_abc123..."]
    }
  }
}
```

**MCP Manifest URL:** `https://shov.com/mcp`

**What Claude can do:**
- ✅ Create new Shov projects
- ✅ Deploy code to global edge
- ✅ Manage data and collections
- ✅ Vector search across data
- ✅ Upload and manage files
- ✅ Set environment secrets
- ✅ Query analytics

**Example AI conversation:**
```
User: "Create a new Shov project called my-saas-app"
Claude: [calls create_project] → "Created! Your API key is shov_live_xyz..."

User: "Deploy a hello world API"
Claude: [calls deploy_code] → "Deployed to https://my-saas-app.shov.dev/api/hello"

User: "Add a user to the database"
Claude: [calls add_to_collection] → "Added user successfully"
```

### 2. Connect AI to Your Shov App API

Connect AI assistants to YOUR custom Shov project APIs:

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "my-app": {
      "command": "npx",
      "args": ["-y", "shov-mcp", "myapp_acme.shov.dev", "--api-key", "pk_abc123..."]
    }
  }
}
```

**Or with custom domain:**
```json
{
  "mcpServers": {
    "my-app": {
      "command": "npx",
      "args": ["-y", "shov-mcp", "api.yourdomain.com", "--api-key", "pk_abc123..."]
    }
  }
}
```

**MCP Manifest URL:** `https://yourproject.shov.dev/mcp` or `https://api.yourdomain.com/mcp`

### Custom Domains

```bash
npx shov-mcp api.yourdomain.com --api-key pk_your_api_key_here
```

### Environment Variables

You can also use environment variables:

```bash
export SHOV_API_KEY=pk_your_api_key_here
npx shov-mcp myapp_acme.shov.dev
```

## Features

- ✅ **Auto-discovery**: Automatically fetches available tools from `/mcp.json`
- ✅ **Type-safe**: Full TypeScript support with JSON Schema validation
- ✅ **Streaming**: Supports streaming responses
- ✅ **Authentication**: Secure API key authentication
- ✅ **Error handling**: Comprehensive error messages

## API Key Management

Get your API key from your Shov project:

### For B2C Auth Projects:
```bash
# Create an API key
curl -X POST https://myapp_acme.shov.dev/auth/api-keys/create \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Claude Desktop", "permissions": ["*"]}'
```

### For B2B Auth Projects:
```bash
# Create a team API key
curl -X POST https://myapp_acme.shov.dev/teams/{teamId}/api-keys/create \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Claude Desktop", "permissions": ["*"]}'
```

## How It Works

1. **Fetches MCP Manifest**: Connects to `https://yourapp.shov.dev/mcp.json`
2. **Registers Tools**: Makes all your API endpoints available as AI tools
3. **Proxies Requests**: Routes tool calls to your API with authentication
4. **Returns Results**: Formats responses for AI consumption

## Example

Once configured, you can ask Claude:

```
User: "List all users in my app"
Claude: [calls list_users tool]
Claude: "Here are the users in your app: ..."

User: "Create a new user named John"
Claude: [calls create_user tool with name: "John"]
Claude: "I've created a new user named John."
```

## Troubleshooting

### "Failed to fetch MCP manifest"
- Check that your Shov project is deployed
- Verify the domain is correct
- Ensure `/mcp.json` endpoint is accessible

### "Invalid API key"
- Verify your API key starts with `pk_`
- Check that the key hasn't been revoked
- Ensure the key hasn't expired

### "Tool not found"
- Make sure your routes have `export const api` with `mcp` section
- Check that `mcp.enabled` is not set to `false`
- Restart Claude Desktop after config changes

## Development

```bash
# Clone the repo
git clone https://github.com/yourusername/shov.git
cd shov/packages/shov-mcp

# Install dependencies
npm install

# Test locally
node src/cli.js myapp_acme.shov.dev --api-key pk_test_key
```

## License

MIT

