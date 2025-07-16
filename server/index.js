#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

class WaveboxControlServer {
  constructor() {
    this.server = new Server(
      {
        name: 'wavebox-control',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  async executeAppleScript(script) {
    try {
      const { stdout, stderr } = await execFileAsync('osascript', ['-e', script]);
      if (stderr) {
        console.error('AppleScript stderr:', stderr);
      }
      return stdout.trim();
    } catch (error) {
      console.error('AppleScript execution error:', error);

      // Check for common permission-related errors
      if (error.message.includes('(-1743)') ||
          error.message.includes('not allowed assistive access') ||
          error.message.includes('not authorized') ||
          error.message.includes('System Events')) {
        throw new Error(
          'Permission denied: Wavebox control requires automation permissions.\n\n' +
          'To grant permission:\n' +
          '1. Open System Settings > Privacy & Security > Automation\n' +
          '2. Find "Claude" in the list\n' +
          '3. Enable "Wavebox" under Claude\n' +
          '4. You may need to restart Claude after granting permission\n\n' +
          'Note: You\'ll see a permission prompt the first time you use this extension.'
        );
      }

      // Check for Wavebox not running
      if (error.message.includes('(-600)') ||
          error.message.includes('application isn\'t running') ||
          error.message.includes('Wavebox')) {
        throw new Error(
          'Wavebox is not running, or in Wavebox, View > Developer > Allow JavaScript from Apple events is not enabled.'
        );
      }

      throw new Error(`AppleScript error: ${error.message}`);
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'open_url',
          description: 'Open a URL in Wavebox',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to open' },
              new_tab: { type: 'boolean', description: 'Open in a new tab', default: true }
            },
            required: ['url']
          }
        },
        {
          name: 'get_current_tab',
          description: 'Get information about the current active tab',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'list_tabs',
          description: 'List all open tabs in Wavebox',
          inputSchema: {
            type: 'object',
            properties: {
              window_id: { type: 'number', description: 'Specific window ID to list tabs from' }
            }
          }
        },
        {
          name: 'close_tab',
          description: 'Close a specific tab',
          inputSchema: {
            type: 'object',
            properties: {
              tab_id: { type: 'number', description: 'ID of the tab to close' }
            },
            required: ['tab_id']
          }
        },
        {
          name: 'switch_to_tab',
          description: 'Switch to a specific tab',
          inputSchema: {
            type: 'object',
            properties: {
              tab_id: { type: 'number', description: 'ID of the tab to switch to' }
            },
            required: ['tab_id']
          }
        },
        {
          name: 'reload_tab',
          description: 'Reload a tab',
          inputSchema: {
            type: 'object',
            properties: {
              tab_id: { type: 'number', description: 'ID of the tab to reload' }
            }
          }
        },
        {
          name: 'go_back',
          description: 'Navigate back in browser history',
          inputSchema: {
            type: 'object',
            properties: {
              tab_id: { type: 'number', description: 'ID of the tab' }
            }
          }
        },
        {
          name: 'go_forward',
          description: 'Navigate forward in browser history',
          inputSchema: {
            type: 'object',
            properties: {
              tab_id: { type: 'number', description: 'ID of the tab' }
            }
          }
        },
        {
          name: 'execute_javascript',
          description: 'Execute JavaScript in the current tab',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'JavaScript code to execute' },
              tab_id: { type: 'number', description: 'ID of the tab' }
            },
            required: ['code']
          }
        },
        {
          name: 'get_page_content',
          description: 'Get the text content of the current page',
          inputSchema: {
            type: 'object',
            properties: {
              tab_id: { type: 'number', description: 'ID of the tab' }
            }
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'open_url': {
            const { url, new_tab = true } = args;
            const script = new_tab
              ? `tell application "Wavebox" to open location "${url}"`
              : `tell application "Wavebox" to set URL of active tab of front window to "${url}"`;

            await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: `Opened ${url} in Wavebox` }] };
          }

          case 'get_current_tab': {
            const script = `
              tell application "Wavebox"
                set currentTab to active tab of front window
                set tabInfo to {URL of currentTab, title of currentTab, id of currentTab}
                return tabInfo
              end tell
            `;
            const result = await this.executeAppleScript(script);
            const [url, title, id] = result.split(', ');
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ url, title, id: parseInt(id) }, null, 2)
              }]
            };
          }

          case 'list_tabs': {
            const script = `
              tell application "Wavebox"
                set tabsList to {}
                repeat with w in windows
                  repeat with t in tabs of w
                    set end of tabsList to {id of t as string, URL of t, title of t}
                  end repeat
                end repeat
                set AppleScript's text item delimiters to "|"
                set output to ""
                repeat with tabInfo in tabsList
                  set output to output & (item 1 of tabInfo) & "," & (item 2 of tabInfo) & "," & (item 3 of tabInfo) & "|"
                end repeat
                return output
              end tell
            `;
            const result = await this.executeAppleScript(script);
            const tabs = result.split('|').filter(tab => tab).map(tab => {
              const [id, url, title] = tab.split(',');
              return { id: parseInt(id), url, title };
            });
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(tabs, null, 2)
              }]
            };
          }

          case 'close_tab': {
            const { tab_id } = args;
            const script = `
              tell application "Wavebox"
                repeat with w in windows
                  repeat with t in tabs of w
                    if (id of t as string) is "${tab_id}" then
                      close t
                      return "Tab closed"
                    end if
                  end repeat
                end repeat
                return "Tab not found"
              end tell
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'switch_to_tab': {
            const { tab_id } = args;
            const script = `
              tell application "Wavebox"
                repeat with w in windows
                  repeat with tabIndex from 1 to count of tabs of w
                    set t to tab tabIndex of w
                    if (id of t as string) is "${tab_id}" then
                      set active tab index of w to tabIndex
                      set index of w to 1
                      activate
                      return "Switched to tab"
                    end if
                  end repeat
                end repeat
                return "Tab not found"
              end tell
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'reload_tab': {
            const { tab_id } = args;
            const script = tab_id ? `
              tell application "Wavebox"
                repeat with w in windows
                  repeat with t in tabs of w
                    if (id of t as string) is "${tab_id}" then
                      reload t
                      return "Tab reloaded"
                    end if
                  end repeat
                end repeat
                return "Tab not found"
              end tell
            ` : `
              tell application "Wavebox"
                reload active tab of front window
                return "Tab reloaded"
              end tell
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'go_back': {
            const { tab_id } = args;
            const script = tab_id ? `
              tell application "Wavebox"
                repeat with w in windows
                  repeat with t in tabs of w
                    if (id of t as string) is "${tab_id}" then
                      go back t
                      return "Navigated back"
                    end if
                  end repeat
                end repeat
                return "Tab not found"
              end tell
            ` : `
              tell application "Wavebox"
                go back active tab of front window
                return "Navigated back"
              end tell
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'go_forward': {
            const { tab_id } = args;
            const script = tab_id ? `
              tell application "Wavebox"
                repeat with w in windows
                  repeat with t in tabs of w
                    if (id of t as string) is "${tab_id}" then
                      go forward t
                      return "Navigated forward"
                    end if
                  end repeat
                end repeat
                return "Tab not found"
              end tell
            ` : `
              tell application "Wavebox"
                go forward active tab of front window
                return "Navigated forward"
              end tell
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result }] };
          }

          case 'execute_javascript': {
            const { code, tab_id } = args;
            // For AppleScript strings, we need to escape backslashes and double quotes
            const escapedCode = code
              .replace(/\\/g, '\\\\')  // Escape backslashes first
              .replace(/"/g, '\\"');   // Then escape double quotes
            const script = tab_id ? `
              tell application "Wavebox"
                repeat with w in windows
                  repeat with t in tabs of w
                    if (id of t as string) is "${tab_id}" then
                      set result to execute t javascript "${escapedCode}"
                      return result
                    end if
                  end repeat
                end repeat
                return "Tab not found"
              end tell
            ` : `
              tell application "Wavebox"
                execute active tab of front window javascript "${escapedCode}"
              end tell
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result || 'JavaScript executed' }] };
          }

          case 'get_page_content': {
            const { tab_id } = args;
            const script = tab_id ? `
              tell application "Wavebox"
                repeat with w in windows
                  repeat with t in tabs of w
                    if (id of t as string) is "${tab_id}" then
                      set pageContent to execute t javascript "document.body.innerText"
                      return pageContent
                    end if
                  end repeat
                end repeat
                return "Tab not found"
              end tell
            ` : `
              tell application "Wavebox"
                execute active tab of front window javascript "document.body.innerText"
              end tell
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result }] };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Wavebox Control MCP server running on stdio');
  }
}

const server = new WaveboxControlServer();
server.run().catch(console.error);