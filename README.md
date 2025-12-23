# Calculateur PDV - Indemnités

Application web simple (HTML/CSS/JavaScript) pour calculer les indemnités de Plan de Départ Volontaire (PDV).

## Fonctionnalités

- Calcul de l'indemnité légale
- Calcul de l'indemnité extra-légale PDV (avec plancher/plafond)
- Calcul du congé de reclassement (pré-avis + congé)
- Primes optionnelles (formation et création d'entreprise)
- Application automatique des planchers/plafonds

## Utilisation

Ouvrir simplement `index.html` dans un navigateur web. Aucune installation requise.

## Versioning

Le projet utilise Git pour le versioning. La version actuelle est affichée dans l'application.

### Initialiser Git (première fois)

```bash
git init
git add .
git commit -m "Version initiale"
```

### Créer une nouvelle version

1. Modifier le fichier `VERSION` avec la nouvelle version (format: X.Y.Z)
2. Ajouter une entrée dans `CHANGELOG.md`
3. Commit et tag :

```bash
git add .
git commit -m "Version X.Y.Z: description des changements"
git tag -a vX.Y.Z -m "Version X.Y.Z"
```

### Partager le projet

**Via GitHub/GitLab :**
```bash
git remote add origin <URL_DU_REPO>
git push -u origin main
git push --tags
```

**Via fichier ZIP :**
- Créer un ZIP du projet
- Inclure la version dans le nom du fichier : `pdv-calculateur-v1.0.0.zip`

## Structure

```
pdv/
├── index.html      # Interface principale
├── style.css       # Styles
├── script.js       # Logique de calcul
├── VERSION         # Version actuelle
├── CHANGELOG.md    # Historique des versions
└── README.md       # Ce fichier
```

## Notes

- Aucune donnée n'est stockée (application 100% côté client)
- Les calculs sont indicatifs, vérifier toujours avec les textes officiels

