#!/bin/bash

echo "🔍 Checking for junk in ~/.bashrc and ~/.profile..."

# Backup original files
cp ~/.bashrc ~/.bashrc.backup
cp ~/.profile ~/.profile.backup

# Clean .bashrc
grep -vE '^\s*$' ~/.bashrc | grep -v '^/dev/fd/' > ~/.bashrc.cleaned
mv ~/.bashrc.cleaned ~/.bashrc
echo "✅ Cleaned ~/.bashrc (backup saved as ~/.bashrc.backup)"

# Clean .profile
grep -vE '^\s*$' ~/.profile | grep -v '^/dev/fd/' > ~/.profile.cleaned
mv ~/.profile.cleaned ~/.profile
echo "✅ Cleaned ~/.profile (backup saved as ~/.profile.backup)"

# Remove empty /dev/fd/63 process that might be hanging
echo "🔄 Reloading shell..."
exec bash
