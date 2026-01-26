# État actuel : Application des impôts et charges sociales

## Résumé des règles appliquées dans le code

### 1. Indemnités légales/conventionnelles (ILL/ICL)
- **Charges sociales** : ✅ Exonérées (aucune charge déduite)
- **Impôts** : ✅ Exonérées d'impôts sur le revenu
- **Code** : `legalNet = legalAdjusted` (ligne 335)
- **Note** : Jusqu'à 2 PASS (96K€) selon la documentation

### 2. Indemnité extra-légale/supra-légale
- **Charges sociales** : ✅ CSG/CRDS uniquement à 9,7%
- **Impôts** : ✅ Exonérée d'impôts sur le revenu
- **Code** : `extraNet = extraAdjusted - (extraAdjusted * 9.7 / 100)` (ligne 339)
- **Calcul** : Brut - 9,7% de CSG/CRDS

### 3. Pré-avis (congé de reclassement)
- **Charges sociales** : ✅ Charges normales estimées à 21%
  - CSG/CRDS + autres cotisations sociales
- **Impôts** : ✅ Soumis à l'impôt sur le revenu (tranche marginale)
- **Code** : 
  - Net avant impôt : `preavisNet = preavisAmountBrut - (preavisAmountBrut * 21 / 100)` (ligne 344-346)
  - Net après impôt : `preavisNetNet = preavisNet - (preavisNet * incomeTaxRate / 100)` (ligne 363-365)

### 4. Allocation de reclassement (après préavis)
- **Charges sociales** : ✅ Charges allégées ~13,4%
  - CSG/CRDS : 6,7% (au lieu de 9,7%)
  - Prévoyance TB : 0,825%
  - Retraite TA : 4,92%
  - Retraite TB : 9,72%
  - CET : 0,14%
  - Total : ~13,4%
- **Impôts** : ✅ Soumise à l'impôt sur le revenu (tranche marginale)
- **Code** : 
  - Net avant impôt : Calculé dans `computeReclassification()` avec charges allégées (ligne 349)
  - Net après impôt : `leaveNetNet = leaveNet - (leaveNet * incomeTaxRate / 100)` (ligne 366-368)

### 5. Primes (formation et création d'entreprise)
- **Charges sociales** : ⚠️ Aucune charge déduite actuellement
  - Code : `primesNet = trainingBonus + businessCreationBonus` (ligne 352)
- **Impôts** : ✅ Soumises à l'impôt sur le revenu (tranche marginale)
- **Code** : `primesNetNet = primesNet - (primesNet * incomeTaxRate / 100)` (ligne 369-371)

## Points à vérifier

### ⚠️ Primes
Les primes (formation et création d'entreprise) sont actuellement traitées comme :
- **Brut = Net avant impôt** (aucune charge sociale déduite)
- **Soumises à l'impôt** uniquement

**Question** : Les primes doivent-elles être soumises à des charges sociales spécifiques ?

### ✅ Répartition proportionnelle après plancher/plafond
Lorsqu'un plancher ou plafond est appliqué sur (légale + extra-légale), la répartition est proportionnelle :
- `legalAdjusted = legalRatio * legalExtraAdjusted`
- `extraAdjusted = extraRatio * legalExtraAdjusted`

Cela préserve les règles fiscales de chaque composante.

## Calculs détaillés

### Total net (avant impôt)
```
totalNet = legalNet + extraNet + preavisNet + leaveNet + primesNet
```

### Total net net (après impôt)
```
totalNetNet = legalNetNet + extraNetNet + preavisNetNet + leaveNetNet + primesNetNet
```

Où :
- `legalNetNet = legalNet` (exonéré)
- `extraNetNet = extraNet` (exonéré)
- `preavisNetNet = preavisNet - impôt`
- `leaveNetNet = leaveNet - impôt`
- `primesNetNet = primesNet - impôt`
