#!/bin/bash
# Script pour mettre à jour la version dans tous les fichiers

if [ -z "$1" ]; then
  echo "Usage: ./update-version.sh <nouvelle_version>"
  echo "Exemple: ./update-version.sh 1.1.0"
  exit 1
fi

NEW_VERSION=$1

# Mettre à jour le fichier VERSION
echo "$NEW_VERSION" > VERSION

# Mettre à jour script.js
sed -i '' "s/const APP_VERSION = '.*';/const APP_VERSION = '$NEW_VERSION';/" script.js

echo "Version mise à jour à $NEW_VERSION dans:"
echo "  - VERSION"
echo "  - script.js"
echo ""
echo "N'oubliez pas de:"
echo "  1. Ajouter une entrée dans CHANGELOG.md"
echo "  2. Commit: git add . && git commit -m \"Version $NEW_VERSION\""
echo "  3. Tag: git tag -a v$NEW_VERSION -m \"Version $NEW_VERSION\""

