# Wavebox Control Extension

Experimental MCP server to control Wavebox through Claude using AppleScript automation.

https://www.youtube.com/watch?v=SQ_Byb1Jw3c

## Features

- **Tab Management**: Open, close, switch between tabs
- **Navigation**: Navigate to URLs, go back/forward in history
- **Page Interaction**: Execute JavaScript, get page content
- **Browser Control**: Reload tabs, list all open tabs

## Available Tools

### `open_url`
Open a URL in Wavebox, either in a new tab or current tab.

### `get_current_tab`
Get information about the currently active tab (URL, title, ID).

### `list_tabs`
List all open tabs across all Wavebox windows.

### `close_tab`
Close a specific tab by its ID.

### `switch_to_tab`
Switch to a specific tab by its ID.

### `reload_tab`
Reload a tab (current tab or specific tab by ID).

### `go_back` / `go_forward`
Navigate through browser history.

### `execute_javascript`
Execute JavaScript code in a tab.

### `get_page_content`
Get the text content of a web page.

## Requirements

- macOS (uses AppleScript)
- Wavebox installed
- In Wavebox, View > Developer > Allow JavaScript from Apple events, should be enabled
- Node.js >= 16.0.0

## Installation

```bash
npm install
```

## Usage

The extension runs as an MCP server and communicates with Claude through stdio.

## Security

This extension requires access to control Wavebox through AppleScript. It can:
- Read and modify web page content
- Navigate to any URL
- Execute JavaScript in browser tabs

Use with appropriate caution and only grant access when necessary.
