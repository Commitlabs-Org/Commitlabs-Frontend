#!/bin/bash

# Validate the OpenAPI specification using Redocly CLI
# This script uses npx to ensure it can be run without global installation.

echo "Validating openapi.yaml..."

npx @redocly/cli lint openapi.yaml