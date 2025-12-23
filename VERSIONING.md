# Guide de Versioning

## Structure de version

Le projet utilise le **Semantic Versioning** (SemVer) : `MAJEUR.MINEUR.PATCH`

- **MAJEUR** : Changements incompatibles (ex: refonte majeure)
- **MINEUR** : Nouvelles fonctionnalités compatibles (ex: ajout d'une prime)
- **PATCH** : Corrections de bugs (ex: correction d'un calcul)

Exemples : `1.0.0` → `1.0.1` (bug fix) → `1.1.0` (nouvelle fonctionnalité) → `2.0.0` (changement majeur)

## Fichiers de version

- `VERSION` : Version actuelle (lisible par les scripts)
- `script.js` : Constante `APP_VERSION` (affichée dans l'app)
- `CHANGELOG.md` : Historique détaillé des versions

## Workflow de mise à jour

### Option 1 : Script automatique (recommandé)

```bash
# Rendre le script exécutable (une seule fois)
chmod +x update-version.sh

# Mettre à jour la version
./update-version.sh 1.1.0
```

Le script met à jour automatiquement `VERSION` et `script.js`.

### Option 2 : Manuel

1. Modifier `VERSION` avec la nouvelle version
2. Modifier `script.js` : `const APP_VERSION = '1.1.0';`
3. Ajouter une entrée dans `CHANGELOG.md`

## Workflow Git complet

### Première initialisation

```bash
# Initialiser le dépôt
git init

# Premier commit
git add .
git commit -m "Version initiale 1.0.0"

# Créer le tag
git tag -a v1.0.0 -m "Version 1.0.0"
```

### Pour une nouvelle version

```bash
# 1. Mettre à jour la version (script ou manuel)
./update-version.sh 1.1.0

# 2. Modifier CHANGELOG.md avec les changements

# 3. Commit
git add .
git commit -m "Version 1.1.0: description des changements"

# 4. Créer le tag
git tag -a v1.1.0 -m "Version 1.1.0"

# 5. Pousser vers le dépôt distant (si configuré)
git push
git push --tags
```

## Partage

### Via Git (GitHub/GitLab)

```bash
# Ajouter le remote
git remote add origin <URL>

# Pousser le code et les tags
git push -u origin main
git push --tags
```

### Via fichier ZIP

1. Créer un ZIP du projet
2. Nommer avec la version : `pdv-calculateur-v1.0.0.zip`
3. Inclure tous les fichiers sauf `.git/` (si présent)

## Vérification

La version est affichée dans le footer de l'application. Vérifier qu'elle correspond à :
- Le fichier `VERSION`
- La constante `APP_VERSION` dans `script.js`
- Le dernier tag Git (si utilisé)

