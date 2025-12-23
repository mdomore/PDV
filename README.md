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

## Versioning et Releases

Le projet utilise Git pour le versioning. La version actuelle est affichée dans l'application.

### Initialiser Git (première fois)

```bash
git init
git add .
git commit -m "Version initiale"
git remote add origin <URL_DU_REPO>
git push -u origin main
```

### Créer une nouvelle version et release

**Méthode simple (recommandée)** :
```bash
# 1. Mettre à jour CHANGELOG.md avec les changements
# 2. Créer la release
chmod +x create-release.sh  # Une seule fois
./create-release.sh 1.1.0
```

Le script va automatiquement :
- Mettre à jour la version
- Créer le tag et le pousser
- Déclencher le workflow GitHub Actions qui créera :
  - Une release GitHub
  - Un ZIP téléchargeable avec la version

Voir `RELEASE.md` pour plus de détails et la méthode manuelle.

### Télécharger une version

Allez sur la page **Releases** du repository GitHub pour télécharger le ZIP d'une version stable.

Voir `RELEASE.md` pour plus de détails.

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

