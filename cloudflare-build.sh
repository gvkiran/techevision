#!/bin/sh
# Cloudflare Pages build: copy only the public website files into dist/
# (so README, package.json, the Vercel api/ folder etc. are not published).
# Cloudflare settings: Build command = sh cloudflare-build.sh   Output directory = dist
set -e
rm -rf dist
mkdir dist
cp ./*.html robots.txt sitemap.xml jobs.json _headers _redirects dist/
cp -r assets css js dist/
echo "Built dist/ with $(find dist -type f | wc -l) files"
