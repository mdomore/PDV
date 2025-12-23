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

# Mettre à jour la version (mode silencieux)
echo "📝 Mise à jour de la version à $NEW_VERSION..."
./update-version.sh "$NEW_VERSION" --quiet

# Vérifier que le CHANGELOG a été mis à jour
if ! grep -q "## \[$NEW_VERSION\]" CHANGELOG.md; then
  echo ""
  echo "⚠️  Le CHANGELOG.md ne contient pas d'entrée pour la version $NEW_VERSION"
  echo ""
  TODAY=$(date +%Y-%m-%d)
  CHANGELOG_ENTRY="## [$NEW_VERSION] - $TODAY

### Ajouté
- 

### Modifié
- 

### Corrigé
- 
"
  echo "Voulez-vous que je génère automatiquement un template dans CHANGELOG.md? (Y/n)"
  read -p "> " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    # Créer un fichier temporaire avec le template
    TEMP_FILE=$(mktemp)
    echo "$CHANGELOG_ENTRY" > "$TEMP_FILE"
    # Insérer après la ligne "# Changelog" (ligne 1)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "1r $TEMP_FILE" CHANGELOG.md
    else
      # Linux
      sed -i "1r $TEMP_FILE" CHANGELOG.md
    fi
    rm "$TEMP_FILE"
    echo "✅ Template ajouté dans CHANGELOG.md"
    echo ""
    read -p "Voulez-vous ouvrir CHANGELOG.md pour le compléter? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
      # Essayer d'ouvrir avec l'éditeur par défaut
      if command -v code &> /dev/null; then
        code CHANGELOG.md
      elif command -v nano &> /dev/null; then
        nano CHANGELOG.md
      elif command -v vim &> /dev/null; then
        vim CHANGELOG.md
      else
        echo "Ouvrez CHANGELOG.md manuellement pour compléter l'entrée"
      fi
      echo ""
      read -p "Appuyez sur Entrée une fois que vous avez complété le CHANGELOG... " -r
    fi
  else
    echo "Ajoutez manuellement l'entrée dans CHANGELOG.md au format:"
    echo "## [$NEW_VERSION] - $TODAY"
    echo ""
    read -p "Appuyez sur Entrée une fois que c'est fait... " -r
  fi
  
  # Vérifier à nouveau après édition
  if ! grep -q "## \[$NEW_VERSION\]" CHANGELOG.md; then
    echo ""
    read -p "Le CHANGELOG n'a toujours pas d'entrée pour $NEW_VERSION. Continuer quand même? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# Commit les changements de version
echo ""
echo "💾 Commit des changements de version..."
git add VERSION script.js
if grep -q "## \[$NEW_VERSION\]" CHANGELOG.md; then
  git add CHANGELOG.md
fi
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

