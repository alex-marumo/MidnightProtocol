#!/bin/bash

WALL="$1"
[ -z "$WALL" ] && exit 0

# Update Quickshell config
quickshell -r "Config.options.background.wallpaperPath = '$WALL'"

# Run End-4 color pipeline WITHOUT resetting wallpaper
~/.config/quickshell/ii/scripts/colors/switchwall.sh --image "$WALL" --noswitch
