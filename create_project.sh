#!/bin/bash

# Ask the user for the desired name of the archive file
read -p "Enter the name for your archive file (e.g., my_project.tar.gz): " ARCHIVE_NAME
if [ -z "$ARCHIVE_NAME" ]; then
    ARCHIVE_NAME="project.tar.gz"
    echo "No name entered. Using default name: ${ARCHIVE_NAME}"
fi

# Define the files and folders to be ignored in an array
IGNORE_LIST=(
    "node_modules"
    ".pnp"
    ".pnp.js"
    "coverage"
    ".next"
    "out"
    "build"
    ".DS_Store"
    "*.pem"
    "npm-debug.log*"
    "yarn-debug.log*"
    "yarn-error.log*"
    ".vercel"
    "*.tsbuildinfo"
    "next-env.d.ts"
    ".git" # <-- This is the key addition to ignore the Git repository files.
)

# Build the exclusion list for the tar command
EXCLUDE_ARGS=""
for item in "${IGNORE_LIST[@]}"; do
    EXCLUDE_ARGS+=" --exclude=$item"
done

# Create the compressed tar archive, excluding the specified files and folders.
# The --exclude flags MUST come before the files/directories to be archived (./).
echo "Creating archive file: ${ARCHIVE_NAME}..."
tar -czf "$ARCHIVE_NAME" $EXCLUDE_ARGS .

echo "Archive file created successfully at: ${ARCHIVE_NAME}"
