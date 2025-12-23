#!/bin/bash
# Script pour créer une nouvelle release GitHub

if [ -z "$1" ]; then
  echo "Usage: ./create-release.sh <nouvelle_version>"
  echo "Exemple: ./create-release.sh 1.1.0"
  exit 1
fi

NEW_VERSION=$1
TAG="v$NEW_VERSION"

# Vérifier que nous sommes sur la branche main/master
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo "⚠️  Attention: vous n'êtes pas sur la branche main/master (actuellement: $CURRENT_BRANCH)"
  read -p "Continuer quand même? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Vérifier que les changements sont commités
if ! git diff-index --quiet HEAD --; then
  echo "❌ Il y a des changements non commités. Committez d'abord vos changements."
  exit 1
fi

# Mettre à jour la version
echo "📝 Mise à jour de la version à $NEW_VERSION..."
./update-version.sh "$NEW_VERSION"

# Vérifier que le CHANGELOG a été mis à jour
if ! grep -q "## \[$NEW_VERSION\]" CHANGELOG.md; then
  echo "⚠️  Attention: Le CHANGELOG.md ne contient pas d'entrée pour la version $NEW_VERSION"
  echo "   Ajoutez une entrée dans CHANGELOG.md avant de continuer."
  read -p "Continuer quand même? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Commit les changements de version
echo "💾 Commit des changements de version..."
git add VERSION script.js CHANGELOG.md
git commit -m "Version $NEW_VERSION"

# Créer le tag
echo "🏷️  Création du tag $TAG..."
git tag -a "$TAG" -m "Version $NEW_VERSION"

# Push
echo "🚀 Push vers GitHub..."
git push
git push origin "$TAG"

echo ""
echo "✅ Release créée avec succès!"
echo ""
echo "Le workflow GitHub Actions va automatiquement:"
echo "  - Créer la release GitHub"
echo "  - Générer le ZIP téléchargeable"
echo ""
echo "Vérifiez l'état sur: https://github.com/<votre-repo>/actions"

