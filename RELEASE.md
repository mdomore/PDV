# Guide de Release GitHub

Ce guide explique comment créer des releases sur GitHub pour distribuer des versions stables de l'application.

## Méthode 1 : Script automatique (recommandé)

Un script simplifie tout le processus de création de release.

### Étapes

1. **Mettre à jour le CHANGELOG.md** avec les changements de la nouvelle version

2. **Créer la release** :
```bash
chmod +x create-release.sh  # Une seule fois
./create-release.sh 1.1.0
```

Le script va automatiquement :
- Mettre à jour la version dans `VERSION` et `script.js` (utilise `update-version.sh` en interne)
- Vérifier que le CHANGELOG est à jour
- Committer les changements
- Créer et pousser le tag
- Déclencher le workflow GitHub Actions

**Note** : Vous n'avez pas besoin d'appeler `update-version.sh` manuellement, `create-release.sh` le fait pour vous.

3. **Le workflow GitHub Actions va automatiquement** :
   - Détecter le tag
   - Créer une release GitHub
   - Générer un ZIP téléchargeable
   - Ajouter le ZIP comme asset de la release

## Méthode 2 : Manuelle (étape par étape)

Si vous préférez faire chaque étape manuellement :

## Méthode 2 : Manuelle (étape par étape)

Si vous préférez faire chaque étape manuellement :

### Étapes

1. **Mettre à jour la version** :
```bash
./update-version.sh 1.1.0
```

2. **Mettre à jour le CHANGELOG.md** avec les changements de cette version

3. **Commit et push** :
```bash
git add .
git commit -m "Version 1.1.0: description des changements"
git push
```

4. **Créer et pousser le tag** :
```bash
git tag -a v1.1.0 -m "Version 1.1.0"
git push origin v1.1.0
```

5. **Le workflow GitHub Actions créera automatiquement la release**

### Ou créer la release manuellement sur GitHub

2. **Créer le tag et le pousser** :
```bash
git tag -a v1.1.0 -m "Version 1.1.0"
git push origin v1.1.0
```

3. **Sur GitHub** :
   - Aller dans "Releases" → "Draft a new release"
   - Sélectionner le tag `v1.1.0`
   - Titre : `Version 1.1.0`
   - Description : Copier le contenu du CHANGELOG.md pour cette version
   - Cliquer sur "Publish release"

4. **Créer le ZIP manuellement** (optionnel) :
```bash
zip -r pdv-calculateur-v1.1.0.zip . \
  -x "*.git*" \
  -x ".github/*" \
  -x "*.DS_Store" \
  -x "update-version.sh"
```

5. **Uploader le ZIP** dans la release GitHub comme asset

## Structure d'une release

Chaque release contient :
- **Tag Git** : `v1.1.0`
- **Release notes** : Extrait du CHANGELOG.md
- **Asset ZIP** : Archive prête à télécharger et utiliser

## Téléchargement

Les utilisateurs peuvent :
1. Aller sur la page "Releases" du repository
2. Télécharger le ZIP de la version souhaitée
3. Extraire et ouvrir `index.html` dans leur navigateur

## Avantages des releases

- ✅ Versions stables identifiables
- ✅ Historique clair des versions
- ✅ Téléchargements faciles (ZIP)
- ✅ Notes de version automatiques
- ✅ Pas de confusion avec le code en développement

