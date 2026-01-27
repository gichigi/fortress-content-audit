#!/bin/bash
# Clean .next folder and restart dev server

echo "🧹 Cleaning .next folder..."
rm -rf .next

echo "🚀 Starting dev server..."
pnpm dev
