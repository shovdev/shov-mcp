#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Shov MCP Server
 * Connects Shov APIs to AI assistants via Model Context Protocol
 */
export class ShovMCPServer {
  constructor(domain, apiKey) {
    this.domain = domain;
    this.apiKey = apiKey;
    this.baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    this.manifest = null;
  }

  /**
   * Fetch MCP manifest from Shov API
   */
  async fetchManifest() {
    try {
      const response = await fetch(`${this.baseUrl}/mcp.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
      }
      this.manifest = await response.json();
      return this.manifest;
    } catch (error) {
      console.error('Error fetching MCP manifest:', error.message);
      throw new Error(`Could not connect to ${this.baseUrl}/mcp.json - ${error.message}`);
    }
  }

  /**
   * Create and start MCP server
   */
  async start() {
    // Fetch manifest
    await this.fetchManifest();

    if (!this.manifest || !this.manifest.tools || this.manifest.tools.length === 0) {
      throw new Error('No tools found in MCP manifest');
    }

    console.error(`✓ Connected to ${this.manifest.name}`);
    console.error(`✓ Found ${this.manifest.tools.length} tools`);

    // Create MCP server
    const server = new Server({
      name: this.manifest.name,
      version: this.manifest.version || '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Register tool list handler
    server.setRequestHandler('tools/list', async () => {
      return {
        tools: this.manifest.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    });

    // Register tool execution handler
    server.setRequestHandler('tools/call', async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};

      // Find tool in manifest
      const tool = this.manifest.tools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool '${toolName}' not found`);
      }

      console.error(`→ Calling ${tool.handler.method} ${tool.handler.url}`);

      try {
        // Make API request
        const response = await this.callTool(tool, args);

        // Return formatted response
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`✗ Error calling tool: ${error.message}`);
        throw error;
      }
    });

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('✓ MCP server started');
  }

  /**
   * Call a tool via HTTP
   */
  async callTool(tool, args) {
    const { url, method } = tool.handler;

    // Build request URL with path parameters
    let requestUrl = url;
    const pathParams = {};
    const queryParams = {};
    const bodyParams = {};

    // Separate parameters by type
    for (const [key, value] of Object.entries(args)) {
      if (requestUrl.includes(`{${key}}`)) {
        pathParams[key] = value;
        requestUrl = requestUrl.replace(`{${key}}`, encodeURIComponent(value));
      } else if (method === 'GET' || method === 'DELETE') {
        queryParams[key] = value;
      } else {
        bodyParams[key] = value;
      }
    }

    // Add query parameters
    if (Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams(queryParams);
      requestUrl += `?${searchParams.toString()}`;
    }

    // Build request options
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'shov-mcp/1.0.0',
        'Accept': 'application/json, text/event-stream' // Accept both JSON and SSE
      }
    };

    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method) && Object.keys(bodyParams).length > 0) {
      options.body = JSON.stringify(bodyParams);
    }

    // Make request
    const response = await fetch(requestUrl, options);

    // Check for errors first
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    // Check if response is SSE stream
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
      console.error('✓ Streaming response detected');
      return await this.handleSSEStream(response);
    }

    // Parse regular response
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return data;
  }

  /**
   * Handle Server-Sent Events (SSE) stream
   */
  async handleSSEStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const events = [];
    let streamedText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          // SSE format: "data: {json}" or "data: text"
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            // Skip [DONE] marker
            if (data === '[DONE]') {
              continue;
            }

            try {
              // Try to parse as JSON
              const parsed = JSON.parse(data);
              events.push(parsed);
              
              // Log progress
              if (parsed.type === 'chunk' || parsed.type === 'delta') {
                streamedText += parsed.content || parsed.text || '';
                process.stderr.write('.');
              } else if (parsed.type === 'progress') {
                console.error(`\n  Progress: ${parsed.message || parsed.status}`);
              } else if (parsed.type === 'error') {
                console.error(`\n  Error: ${parsed.error || parsed.message}`);
              }
            } catch (e) {
              // Not JSON, treat as plain text
              events.push({ type: 'text', content: data });
              streamedText += data;
              process.stderr.write('.');
            }
          }
        }
      }

      console.error(' ✓ Stream complete');

      // Return formatted response
      if (streamedText) {
        // If we accumulated text, return it as the main content
        return {
          type: 'stream',
          content: streamedText,
          events: events,
          eventCount: events.length
        };
      } else if (events.length > 0) {
        // Return all events if no text was accumulated
        return {
          type: 'stream',
          events: events,
          eventCount: events.length
        };
      } else {
        return {
          type: 'stream',
          message: 'Stream completed with no data',
          events: []
        };
      }
    } catch (error) {
      console.error(`\n✗ Stream error: ${error.message}`);
      throw new Error(`SSE stream error: ${error.message}`);
    }
  }
}

export default ShovMCPServer;
