#!/bin/bash

# Validate the OpenAPI specification using Redocly CLI
# This script uses npx to ensure it can be run without global installation.

echo "Validating docs/openapi.yaml..."

npx @redocly/cli lint docs/openapi.yaml