# MCP Server Starter - Lambda Edition

Run an MCP Server in AWS Lambda.

## Deploy

A github action exists, which will deploy to an existing lambda function.

The function must be named:

- mcp-server-stage1
- mcp-server-stage2
- mcp-server-live

The action needs two repo-level secrets:

- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

## Extending

