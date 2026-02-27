// Version de l'application (à synchroniser avec le fichier VERSION)
const APP_VERSION = '1.1.15';

function parseNumber(input) {
  if (!input) return 0;
  const value = parseFloat(input.value.replace(',', '.'));
  return isNaN(value) ? 0 : value;
}

function formatCurrency(value) {
  if (!isFinite(value) || isNaN(value)) return '0 €';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function clamp(value, min, max) {
  if (max != null && value > max) return max;
  if (min != null && value < min) return min;
  return value;
}

// Version retenue : Accord signé uniquement

function getMultiplierBySeniority(totalYears) {
  // Accord signé : multiplicateur selon la tranche atteinte
  if (totalYears <= 5) {
    return 1.0; // 1 à 5 ans
  } else if (totalYears <= 10) {
    return 1.0; // 5 à 10 ans
  } else if (totalYears <= 15) {
    return 1.2; // 10 à 15 ans
  } else {
    return 1.5; // +15 ans
  }
}

function getFloorBySeniority(totalYears) {
  // Accord signé : planchers selon ancienneté
  if (totalYears <= 5) {
    return 70000; // 1 à 5 ans (inclusif)
  } else if (totalYears <= 10) {
    return 90000; // 5 à 10 ans (inclusif)
  } else if (totalYears <= 15) {
    return 110000; // 10 à 15 ans (inclusif)
  } else {
    return 130000; // +15 ans
  }
}

function computeLegalIndemnity(refMonthly, years, months, illFracFirst, illFracAfter, iclFracFirst, iclFracAfter) {
  const totalYears = years + months / 12;
  const cappedFirst = Math.min(totalYears, 10);
  const remaining = Math.max(totalYears - 10, 0);

  // Calcul ILL (Indemnité Légale de Licenciement)
  const illMonthsEq = cappedFirst * illFracFirst + remaining * illFracAfter;
  const illAmount = refMonthly * illMonthsEq;

  // Calcul ICL (Indemnité Conventionnelle Casino)
  const iclMonthsEq = cappedFirst * iclFracFirst + remaining * iclFracAfter;
  const iclAmount = refMonthly * iclMonthsEq;

  // Retenir le montant le plus favorable
  const amount = Math.max(illAmount, iclAmount);
  const monthsEq = amount === illAmount ? illMonthsEq : iclMonthsEq;
  const isILL = amount === illAmount;

  let detail = '';
  if (illAmount === iclAmount) {
    detail = `${monthsEq.toFixed(2)} mois de salaire (ILL = ICL)`;
  } else if (isILL) {
    detail = `${monthsEq.toFixed(2)} mois de salaire - ILL retenue (${illAmount.toFixed(2)} €) > ICL (${iclAmount.toFixed(2)} €)`;
  } else {
    detail = `${monthsEq.toFixed(2)} mois de salaire - ICL retenue (${iclAmount.toFixed(2)} €) > ILL (${illAmount.toFixed(2)} €)`;
  }

  return {
    amount,
    monthsEq,
    totalYears,
    illAmount,
    iclAmount,
    isILL,
    detail,
  };
}

function computeExtraLegal(refMonthly, totalYears, minMonths, customMultiplier = null) {
  // Accord signé : multiplicateur de la tranche atteinte appliqué à l'ensemble des années
  let monthsEq = 0;
  let detailParts = [];
  
  // Si un multiplicateur personnalisé est fourni, l'utiliser directement
  if (customMultiplier !== null && customMultiplier > 0) {
    monthsEq = totalYears * customMultiplier;
    detailParts.push(`${totalYears.toFixed(2)} ans × ${customMultiplier.toFixed(2)}`);
  } else {
    // Le multiplicateur de la tranche atteinte s'applique à l'ensemble des années
    // Ex. 16 ans → tranche +15 ans → 1,5 × 16 = 24 mois
    let multiplier = 1.0;
    let trancheLabel = '1-5 ans';
    if (totalYears <= 5) {
      multiplier = 1.0;
      trancheLabel = '1-5 ans';
    } else if (totalYears <= 10) {
      multiplier = 1.0;
      trancheLabel = '5-10 ans';
    } else if (totalYears <= 15) {
      multiplier = 1.2;
      trancheLabel = '10-15 ans';
    } else {
      multiplier = 1.5;
      trancheLabel = '+15 ans';
    }
    monthsEq = totalYears * multiplier;
    detailParts.push(`${totalYears.toFixed(2)} ans × ${multiplier.toFixed(1)} (tranche ${trancheLabel})`);
  }
  
  monthsEq = Math.max(monthsEq, minMonths);
  const amount = refMonthly * monthsEq;
  
  const detailText = minMonths > 0 
    ? `${monthsEq.toFixed(2)} mois de salaire de référence (${detailParts.join(' + ')}, plancher ${minMonths} mois)`
    : `${monthsEq.toFixed(2)} mois de salaire de référence (${detailParts.join(' + ')})`;

  return {
    amount,
    monthsEq,
    detail: detailText,
  };
}

function computeReclassification(
  preavisBaseMonthly,
  preavisMonths,
  preavisRate,
  preavisUsed,
  leaveRefMonthly,
  leaveMonths,
  leaveRate,
  leaveUsed,
  reducedRate,
  csgCrdsRate,
  prevoyanceRate,
  mutuelleRate,
  retraiteTaRate,
  retraiteTbRate,
  cetRate
) {
  // Calcul pré-avis
  const preavisRemaining = Math.max(preavisMonths - preavisUsed, 0);
  const preavisMonthlyAllowance = preavisBaseMonthly * (preavisRate / 100);
  const preavisAmountBrut = preavisMonthlyAllowance * preavisRemaining;
  const preavisTotalPeriodBrut = preavisMonthlyAllowance * preavisMonths; // valeur totale sur toute la période

  // Calcul congé : X mois effectués à 80% du brut + Y mois non effectués à 80% de la valeur restante (64% du brut)
  const leaveMonthlyAllowance = leaveRefMonthly * (leaveRate / 100); // 80% du brut par mois si consommé
  const leaveUsedClamped = Math.min(Math.max(leaveUsed, 0), leaveMonths);
  const leaveRemaining = Math.max(leaveMonths - leaveUsedClamped, 0);
  const leaveTotalPeriodBrut = leaveMonthlyAllowance * leaveMonths; // valeur totale si tout le congé est consommé (tous les mois à 80%)
  const leaveEffectuesBrut = leaveMonthlyAllowance * leaveUsedClamped; // X mois effectués à 80% du brut
  const leaveRemainingAt80 = leaveMonthlyAllowance * leaveRemaining; // valeur restante au taux 80%/mois
  // Mois non consommés : on verse toujours reducedRate % (ex. 80%) de cette valeur = 80% des 80% par mois non fait (64%)
  const leaveNonEffectuesBrut = leaveRemaining > 0 ? leaveRemainingAt80 * (reducedRate / 100) : 0;
  const leaveAmountBrut = leaveEffectuesBrut + leaveNonEffectuesBrut;

  // Calcul des cotisations sociales sur l'allocation de reclassement (après préavis)
  // Cotisations allégées sur allocation de reclassement (~13,4% vs ~21% habituellement)
  const leaveCSGCRDS = leaveAmountBrut * (csgCrdsRate / 100);
  const leavePrevoyance = leaveAmountBrut * (prevoyanceRate / 100);
  const leaveMutuelle = leaveAmountBrut * (mutuelleRate / 100);
  const leaveRetraiteTA = leaveAmountBrut * (retraiteTaRate / 100);
  const leaveRetraiteTB = leaveAmountBrut * (retraiteTbRate / 100);
  const leaveCET = leaveAmountBrut * (cetRate / 100);
  const leaveTotalCharges = leaveCSGCRDS + leavePrevoyance + leaveMutuelle + leaveRetraiteTA + leaveRetraiteTB + leaveCET;
  const leaveAmountNet = leaveAmountBrut - leaveTotalCharges;

  // Pour le total brut, on utilise les montants bruts
  const totalAmount = preavisAmountBrut + leaveAmountBrut;
  const totalRemaining = preavisRemaining + leaveRemaining;

  let detail = '';
  if (preavisRemaining > 0 && leaveRemaining > 0) {
    detail = `${preavisRemaining.toFixed(2)} mois pré-avis (${preavisRate.toFixed(0)}%) + ${leaveRemaining.toFixed(2)} mois congé (${leaveRate.toFixed(0)}%) → ${reducedRate.toFixed(0)}% payé car congé réduit`;
  } else if (preavisRemaining > 0) {
    detail = `${preavisRemaining.toFixed(2)} mois pré-avis non consommés (${preavisRate.toFixed(0)}%)`;
  } else if (leaveRemaining > 0) {
    detail = `${leaveRemaining.toFixed(2)} mois congé non consommés (${leaveRate.toFixed(0)}%) → ${reducedRate.toFixed(0)}% payé car congé réduit`;
  } else {
    detail = 'Aucun mois restant (tout le congé a été consommé)';
  }

  return {
    amount: totalAmount,
    preavisAmount: preavisAmountBrut,
    preavisAmountBrut,
    preavisMonths,
    preavisTotalPeriodBrut,
    leaveAmount: leaveAmountBrut,
    leaveAmountBrut,
    leaveEffectuesBrut,
    leaveNonEffectuesBrut,
    leaveAmountNet,
    leaveMonths,
    leaveTotalPeriodBrut,
    leaveMonthlyAllowance,
    leaveCSGCRDS,
    leavePrevoyance,
    leaveMutuelle,
    leaveRetraiteTA,
    leaveRetraiteTB,
    leaveCET,
    leaveTotalCharges,
    preavisRemaining,
    leaveRemaining,
    totalRemaining,
    detail,
  };
}

function handleSubmit(event) {
  event.preventDefault();

  const annualGross = parseNumber(document.getElementById('annual-gross'));
  const seniorityYears = parseNumber(document.getElementById('seniority-years'));
  const seniorityMonths = parseNumber(document.getElementById('seniority-months'));
  const refMonths = Math.max(parseNumber(document.getElementById('reference-months')), 1);
  const incomeTaxRate = parseNumber(document.getElementById('income-tax-rate'));

  const illFracFirst = parseNumber(document.getElementById('ill-fraction-first'));
  const illFracAfter = parseNumber(document.getElementById('ill-fraction-after'));
  const iclFracFirst = parseNumber(document.getElementById('icl-fraction-first'));
  const iclFracAfter = parseNumber(document.getElementById('icl-fraction-after'));

  const extraMinMonths = parseNumber(document.getElementById('extra-min-months'));
  const legalExtraFloor = parseNumber(document.getElementById('legal-extra-floor'));
  const legalExtraCeiling = parseNumber(document.getElementById('legal-extra-ceiling'));

  const reclassPreavisMonths = parseNumber(document.getElementById('reclass-preavis-months'));
  const reclassPreavisRate = parseNumber(document.getElementById('reclass-preavis-rate'));
  const reclassPreavisUsed = parseNumber(document.getElementById('reclass-preavis-used'));
  const reclassLeaveMonths = parseNumber(document.getElementById('reclass-leave-months'));
  const reclassLeaveRate = parseNumber(document.getElementById('reclass-leave-rate'));
  const reclassLeaveUsed = parseNumber(document.getElementById('reclass-leave-used'));
  const reclassReducedRate = parseNumber(document.getElementById('reclass-reduced-rate'));
  
  // Cotisations sociales sur allocation de reclassement
  const leaveCSGCRDSRate = parseNumber(document.getElementById('leave-csg-crds-rate'));
  const leavePrevoyanceRate = parseNumber(document.getElementById('leave-prevoyance-rate'));
  const leaveMutuelleRate = parseNumber(document.getElementById('leave-mutuelle-rate'));
  const leaveRetraiteTARate = parseNumber(document.getElementById('leave-retraite-ta-rate'));
  const leaveRetraiteTBRate = parseNumber(document.getElementById('leave-retraite-tb-rate'));
  const leaveCETRate = parseNumber(document.getElementById('leave-cet-rate'));

  const trainingBonusEnabled = document.getElementById('training-bonus-enabled').checked;
  const businessCreationBonusEnabled = document.getElementById('business-creation-bonus-enabled').checked;
  const trainingBonus = trainingBonusEnabled ? parseNumber(document.getElementById('training-bonus')) : 0;
  const businessCreationBonus = businessCreationBonusEnabled ? parseNumber(document.getElementById('business-creation-bonus')) : 0;

  if (annualGross <= 0 || seniorityYears < 0 || seniorityMonths < 0) {
    alert('Merci de saisir au minimum un salaire brut annuel et une ancienneté valide.');
    return;
  }

  const refMonthly = annualGross / refMonths;
  const baseMonthlyInput = parseNumber(document.getElementById('base-monthly'));
  const legalRefMonthlyInput = parseNumber(document.getElementById('legal-ref-monthly'));
  const extraRefMonthlyInput = parseNumber(document.getElementById('extra-ref-monthly'));

  const baseMonthly = baseMonthlyInput > 0 ? baseMonthlyInput : refMonthly;
  const legalRefMonthly = legalRefMonthlyInput > 0 ? legalRefMonthlyInput : refMonthly;
  const extraRefMonthly = extraRefMonthlyInput > 0 ? extraRefMonthlyInput : refMonthly;
  const totalYears = seniorityYears + seniorityMonths / 12;

  const legal = computeLegalIndemnity(
    legalRefMonthly,
    seniorityYears,
    seniorityMonths,
    illFracFirst,
    illFracAfter,
    iclFracFirst,
    iclFracAfter
  );

  // Récupération du multiplicateur (saisi manuellement ou calculé automatiquement)
  const multiplierInput = document.getElementById('extra-multiplier');
  let multiplier = null;
  let useCustomMultiplier = false;
  
  if (multiplierInput) {
    const manualMultiplier = parseNumber(multiplierInput);
    const autoMultiplier = getMultiplierBySeniority(totalYears);
    
    const isManuallyEdited = multiplierInput.dataset.manualEdit === 'true';
    const isDifferentFromAuto = Math.abs(manualMultiplier - autoMultiplier) > 0.01;
    
    if (isManuallyEdited || (manualMultiplier > 0 && isDifferentFromAuto)) {
      multiplier = manualMultiplier;
      useCustomMultiplier = true;
    } else {
      multiplier = autoMultiplier;
      multiplierInput.value = multiplier.toFixed(2);
      multiplierInput.dataset.manualEdit = 'false';
    }
  } else {
    multiplier = getMultiplierBySeniority(totalYears);
  }
  
  const extraRaw = computeExtraLegal(
    extraRefMonthly, 
    totalYears, 
    extraMinMonths, 
    useCustomMultiplier ? multiplier : null
  );

  // Application du plancher et plafond sur la somme légale + extra-légale
  const legalExtraSum = legal.amount + extraRaw.amount;
  const MIN_LEGAL_EXTRA = legalExtraFloor > 0 ? legalExtraFloor : null;
  const MAX_LEGAL_EXTRA = legalExtraCeiling > 0 ? legalExtraCeiling : null;
  const legalExtraAdjusted = clamp(legalExtraSum, MIN_LEGAL_EXTRA, MAX_LEGAL_EXTRA);

  const reclass = computeReclassification(
    baseMonthly,
    reclassPreavisMonths,
    reclassPreavisRate,
    reclassPreavisUsed,
    legalRefMonthly,
    reclassLeaveMonths,
    reclassLeaveRate,
    reclassLeaveUsed,
    reclassReducedRate,
    leaveCSGCRDSRate,
    leavePrevoyanceRate,
    leaveMutuelleRate,
    leaveRetraiteTARate,
    leaveRetraiteTBRate,
    leaveCETRate
  );

  // Total brut
  const totalBrut = legalExtraAdjusted + reclass.amount + trainingBonus + businessCreationBonus;
  
  // ============================================================================
  // CALCUL DES CHARGES SOCIALES ET IMPÔTS
  // ============================================================================
  
  // Légal = montant légal inchangé. Extra-légal = différence (total ajusté - légal).
  // La CSG/CRDS ne s'applique que sur la part extra-légale.
  const legalAdjusted = legal.amount;
  const extraAdjusted = Math.max(legalExtraAdjusted - legal.amount, 0);
  
  // 1. INDEMNITÉS LÉGALES/CONVENTIONNELLES (ILL/ICL)
  // - Charges sociales : EXONÉRÉES (jusqu'à 2 PASS = 96K€)
  // - Impôts : EXONÉRÉS
  const legalNet = legalAdjusted;
  
  // 2. INDEMNITÉ SUPRA-LÉGALE (extra-légale = différence plancher/plafond - légal)
  // - Charges sociales : CSG/CRDS uniquement à 9,7%, appliquée juste après sur cette part
  // - Impôts : EXONÉRÉS
  const SUPRA_LEGAL_CSG_CRDS_RATE = 9.7;
  const extraNet = extraAdjusted - (extraAdjusted * (SUPRA_LEGAL_CSG_CRDS_RATE / 100));
  
  // 3. PRÉ-AVIS (congé de reclassement)
  // - Charges sociales : Charges normales estimées à 21% (CSG/CRDS + cotisations)
  // - Impôts : SOUMIS à l'impôt sur le revenu (tranche marginale)
  const PREAVIS_CHARGES_RATE = 23; // Estimation charges normales (simulation employeur)
  const preavisNet = reclass.preavisAmountBrut > 0 
    ? reclass.preavisAmountBrut - (reclass.preavisAmountBrut * (PREAVIS_CHARGES_RATE / 100))
    : 0;
  
  // 4. ALLOCATION DE RECLASSEMENT (après préavis)
  // - Charges sociales : Charges allégées ~13,4% (calculées dans computeReclassification)
  //   - CSG/CRDS : 6,7% (au lieu de 9,7%)
  //   - Prévoyance TB : 0,825%
  //   - Retraite TA : 4,92%
  //   - Retraite TB : 9,72%
  //   - CET : 0,14%
  // - Impôts : SOUMIS à l'impôt sur le revenu (tranche marginale)
  const leaveNet = reclass.leaveAmountNet || 0;
  
  // 5. PRIMES (formation et création d'entreprise)
  // - Charges sociales : Aucune charge déduite actuellement
  // - Impôts : SOUMIS à l'impôt sur le revenu (tranche marginale)
  // ⚠️ À vérifier : Les primes doivent-elles être soumises à des charges sociales spécifiques ?
  const primesNet = trainingBonus + businessCreationBonus;
  
  // Total net (avant impôt)
  const totalNet = legalNet + extraNet + preavisNet + leaveNet + primesNet;
  
  // ============================================================================
  // CALCUL DE L'IMPÔT SUR LE REVENU
  // ============================================================================
  
  // Éléments EXONÉRÉS d'impôts
  const legalNetNet = legalNet; // Indemnités légales/conventionnelles
  const extraNetNet = extraNet; // Indemnité supra-légale
  
  // Éléments SOUMIS à l'impôt sur le revenu (tranche marginale)
  const preavisNetNet = preavisNet > 0 
    ? preavisNet - (preavisNet * (incomeTaxRate / 100))
    : 0;
  const leaveNetNet = leaveNet > 0
    ? leaveNet - (leaveNet * (incomeTaxRate / 100))
    : 0;
  const primesNetNet = primesNet > 0
    ? primesNet - (primesNet * (incomeTaxRate / 100))
    : 0;
  
  // Total net net (après impôt)
  const totalNetNet = legalNetNet + extraNetNet + preavisNetNet + leaveNetNet + primesNetNet;
  
  const total = totalBrut;

  document.getElementById('legal-amount').textContent = formatCurrency(legal.amount);
  let legalDetailText = legal.detail;
  if (legal.illAmount !== legal.iclAmount) {
    legalDetailText += `\nILL: ${formatCurrency(legal.illAmount)} | ICL: ${formatCurrency(legal.iclAmount)}`;
  }
  document.getElementById('legal-detail').textContent = legalDetailText;

  document.getElementById('extra-amount').textContent = formatCurrency(extraRaw.amount);
  document.getElementById('extra-detail').textContent = extraRaw.detail;
  const extraNetDetailEl = document.getElementById('extra-net-detail');
  if (extraNetDetailEl) {
    if (extraAdjusted > 0) {
      extraNetDetailEl.textContent = `Net (après CSG/CRDS 9,7 %) : ${formatCurrency(extraNet)}`;
      extraNetDetailEl.style.display = '';
    } else {
      extraNetDetailEl.textContent = '';
      extraNetDetailEl.style.display = 'none';
    }
  }

  // Affichage de la somme (légale + extra-légale) ajustée
  document.getElementById('legal-extra-sum-amount').textContent = formatCurrency(legalExtraAdjusted);
  const legalExtraNetEl = document.getElementById('legal-extra-net-amount');
  if (legalExtraNetEl) {
    const indemnityNet = legalNet + extraNet; // légale (exonérée) + extra nette (CSG 9,7 % sur part extra-légale uniquement)
    if (legalExtraAdjusted > 0) {
      legalExtraNetEl.textContent = `Net (CSG 9,7 % sur part extra-légale uniquement) : ${formatCurrency(indemnityNet)}`;
      legalExtraNetEl.style.display = '';
    } else {
      legalExtraNetEl.textContent = '';
      legalExtraNetEl.style.display = 'none';
    }
  }
  const legalExtraSumDetailEl = document.getElementById('legal-extra-sum-detail');
  if (MIN_LEGAL_EXTRA != null && legalExtraSum < MIN_LEGAL_EXTRA) {
    legalExtraSumDetailEl.textContent = `Théorique : ${formatCurrency(legalExtraSum)} → Plancher de ${formatCurrency(MIN_LEGAL_EXTRA)} appliqué (ancienneté ${totalYears.toFixed(2)} ans)`;
  } else if (MAX_LEGAL_EXTRA != null && legalExtraSum > MAX_LEGAL_EXTRA) {
    legalExtraSumDetailEl.textContent = `Théorique : ${formatCurrency(legalExtraSum)} → Plafond de ${formatCurrency(MAX_LEGAL_EXTRA)} appliqué`;
  } else {
    legalExtraSumDetailEl.textContent = `Aucun ajustement (plancher/plafond)`;
  }
  
  // Affichage : ordre légal puis extra-légal avec CSG/CRDS 9,7 % uniquement sur la part extra-légale
  const legalExtraCsgDetailEl = document.getElementById('legal-extra-csg-detail');
  if (legalExtraCsgDetailEl) {
    if (extraAdjusted > 0) {
      legalExtraCsgDetailEl.textContent = `Légal : ${formatCurrency(legalAdjusted)} (sans charges). Puis part extra-légale : ${formatCurrency(extraAdjusted)} avec CSG/CRDS 9,7 % → net ${formatCurrency(extraNet)}.`;
      legalExtraCsgDetailEl.style.display = '';
    } else {
      legalExtraCsgDetailEl.textContent = '';
      legalExtraCsgDetailEl.style.display = 'none';
    }
  }

  document.getElementById('reclass-amount').textContent = formatCurrency(reclass.amount);

  // Valeur totale sur la période (préavis + congé) — brut, net, net net
  const sectionPeriodTotals = document.getElementById('period-totals-section');
  if (sectionPeriodTotals) {
    const hasPreavis = (reclass.preavisMonths || 0) > 0;
    const hasLeave = (reclass.leaveMonths || 0) > 0;
    if (hasPreavis || hasLeave) {
      sectionPeriodTotals.style.display = '';

      // Préavis : total période net / net net + détail mensuel
      if (hasPreavis) {
        const preavisPeriodNet = (reclass.preavisTotalPeriodBrut || 0) * (1 - PREAVIS_CHARGES_RATE / 100);
        const preavisPeriodNetNet = preavisPeriodNet * (1 - incomeTaxRate / 100);
        const preavisMonthsNum = reclass.preavisMonths || 0;
        document.getElementById('preavis-period-months').textContent = preavisMonthsNum;
        document.getElementById('preavis-period-brut').textContent = formatCurrency(reclass.preavisTotalPeriodBrut || 0);
        document.getElementById('preavis-period-net').textContent = formatCurrency(preavisPeriodNet);
        document.getElementById('preavis-period-netnet').textContent = formatCurrency(preavisPeriodNetNet);
        document.getElementById('preavis-period-monthly').textContent = preavisMonthsNum > 0
          ? `brut ${formatCurrency((reclass.preavisTotalPeriodBrut || 0) / preavisMonthsNum)} | net ${formatCurrency(preavisPeriodNet / preavisMonthsNum)} | net net ${formatCurrency(preavisPeriodNetNet / preavisMonthsNum)}`
          : '—';
      } else {
        document.getElementById('preavis-period-months').textContent = '0';
        document.getElementById('preavis-period-monthly').textContent = '—';
        ['preavis-period-brut', 'preavis-period-net', 'preavis-period-netnet'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = '0 €';
        });
      }

      // Congé : total = durée totale = X mois effectués (80%) + Y mois non effectués (64%)
      if (hasLeave) {
        const leaveMonthsNum = reclass.leaveMonths || 0;            // durée totale
        const leaveRemainingNum = reclass.leaveRemaining || 0;      // Y = mois non effectués
        const leaveUsedNum = leaveMonthsNum - leaveRemainingNum;    // X = mois effectués
        document.getElementById('leave-period-months').textContent = leaveMonthsNum;
        document.getElementById('leave-repartition').textContent = `${leaveUsedNum} mois effectués + ${leaveRemainingNum} mois non effectués`;

        const leaveChargeRatePct = reclass.leaveAmountBrut > 0
          ? (reclass.leaveTotalCharges / reclass.leaveAmountBrut) * 100
          : (leaveCSGCRDSRate + leavePrevoyanceRate + leaveMutuelleRate + leaveRetraiteTARate + leaveRetraiteTBRate + leaveCETRate);

        // X mois effectués (80% du brut/mois) — perçus si tu restes X mois
        const leaveEffectuesBrut = reclass.leaveEffectuesBrut || 0;
        const leaveEffectuesNet = leaveEffectuesBrut * (1 - leaveChargeRatePct / 100);
        const leaveEffectuesNetNet = leaveEffectuesNet * (1 - incomeTaxRate / 100);
        document.getElementById('leave-effectues-label').textContent = `${leaveUsedNum} mois effectués (80% du brut/mois)`;
        document.getElementById('leave-effectues-brut').textContent = formatCurrency(leaveEffectuesBrut);
        document.getElementById('leave-effectues-net').textContent = formatCurrency(leaveEffectuesNet);
        document.getElementById('leave-effectues-netnet').textContent = formatCurrency(leaveEffectuesNetNet);
        document.getElementById('leave-effectues-monthly').textContent = leaveUsedNum > 0
          ? `brut ${formatCurrency(leaveEffectuesBrut / leaveUsedNum)} | net ${formatCurrency(leaveEffectuesNet / leaveUsedNum)} | net net ${formatCurrency(leaveEffectuesNetNet / leaveUsedNum)}`
          : '—';

        // Y mois non effectués (64% du brut/mois) — versés en capital
        const leaveNonEffectuesBrut = reclass.leaveNonEffectuesBrut || 0;
        document.getElementById('leave-non-effectues-label').textContent = `${leaveRemainingNum} mois non effectués (64% du brut/mois)`;
        if (leaveNonEffectuesBrut > 0 && reclass.leaveAmountBrut > 0) {
          const ratio = leaveNonEffectuesBrut / reclass.leaveAmountBrut;
          const leaveNonEffectuesNet = leaveNet * ratio;
          const leaveNonEffectuesNetNet = leaveNetNet * ratio;
          document.getElementById('leave-remaining-brut').textContent = formatCurrency(leaveNonEffectuesBrut);
          document.getElementById('leave-remaining-net').textContent = formatCurrency(leaveNonEffectuesNet);
          document.getElementById('leave-remaining-netnet').textContent = formatCurrency(leaveNonEffectuesNetNet);
          document.getElementById('leave-remaining-monthly').textContent = leaveRemainingNum > 0
            ? `brut ${formatCurrency(leaveNonEffectuesBrut / leaveRemainingNum)} | net ${formatCurrency(leaveNonEffectuesNet / leaveRemainingNum)} | net net ${formatCurrency(leaveNonEffectuesNetNet / leaveRemainingNum)}`
            : '—';
        } else {
          document.getElementById('leave-remaining-brut').textContent = '0 €';
          document.getElementById('leave-remaining-net').textContent = '0 €';
          document.getElementById('leave-remaining-netnet').textContent = '0 €';
          document.getElementById('leave-remaining-monthly').textContent = '—';
        }
      } else {
        document.getElementById('leave-period-months').textContent = '0';
        document.getElementById('leave-repartition').textContent = '0 mois effectués + 0 mois non effectués';
        document.getElementById('leave-effectues-label').textContent = '0 mois effectués (80% du brut/mois)';
        document.getElementById('leave-effectues-monthly').textContent = '—';
        document.getElementById('leave-non-effectues-label').textContent = '0 mois non effectués (64% du brut/mois)';
        document.getElementById('leave-remaining-monthly').textContent = '—';
        ['leave-effectues-brut', 'leave-effectues-net', 'leave-effectues-netnet', 'leave-remaining-brut', 'leave-remaining-net', 'leave-remaining-netnet'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = '0 €';
        });
      }
    } else {
      sectionPeriodTotals.style.display = 'none';
    }
  }

  // Détail avec cotisations sociales sur allocation de reclassement
  let reclassDetail = reclass.detail;
  if (reclass.leaveRemaining > 0) {
    reclassDetail += `\n\nAllocation de reclassement (après préavis):`;
    reclassDetail += `\nBrut: ${formatCurrency(reclass.leaveAmountBrut)}`;
    reclassDetail += `\nCSG/CRDS: ${formatCurrency(reclass.leaveCSGCRDS)} (${leaveCSGCRDSRate.toFixed(2)}%)`;
    reclassDetail += `\nPrévoyance TB: ${formatCurrency(reclass.leavePrevoyance)} (${leavePrevoyanceRate.toFixed(3)}%)`;
    reclassDetail += `\nMutuelle: ${formatCurrency(reclass.leaveMutuelle)} (${leaveMutuelleRate.toFixed(2)}%)`;
    reclassDetail += `\nRetraite TA: ${formatCurrency(reclass.leaveRetraiteTA)} (${leaveRetraiteTARate.toFixed(2)}%)`;
    reclassDetail += `\nRetraite TB: ${formatCurrency(reclass.leaveRetraiteTB)} (${leaveRetraiteTBRate.toFixed(2)}%)`;
    reclassDetail += `\nCET T1&T2: ${formatCurrency(reclass.leaveCET)} (${leaveCETRate.toFixed(2)}%)`;
    reclassDetail += `\nTotal charges: ${formatCurrency(reclass.leaveTotalCharges)} (~${((reclass.leaveTotalCharges / reclass.leaveAmountBrut) * 100).toFixed(1)}%)`;
    reclassDetail += `\nNet (avant impôt): ${formatCurrency(reclass.leaveAmountNet)}`;
    reclassDetail += `\n⚠️ Soumis à l'impôt sur le revenu (tranche marginale)`;
  }
  document.getElementById('reclass-detail').textContent = reclassDetail;

  document.getElementById('training-amount').textContent = formatCurrency(trainingBonus);
  document.getElementById('training-detail').textContent = trainingBonusEnabled 
    ? 'Prime unique pour formation' 
    : 'Prime désactivée';

  document.getElementById('business-amount').textContent = formatCurrency(businessCreationBonus);
  document.getElementById('business-detail').textContent = businessCreationBonusEnabled 
    ? 'Prime totale payée en 2 fois' 
    : 'Prime désactivée';

  // Calcul du sous-total avant application plancher/plafond sur (légale + extra-légale)
  const subtotalBeforeAdjustment = legal.amount + extraRaw.amount + reclass.amount + trainingBonus + businessCreationBonus;
  document.getElementById('subtotal-amount').textContent = formatCurrency(subtotalBeforeAdjustment);

  document.getElementById('total-amount').textContent = formatCurrency(totalBrut);
  const totalDetailEl = document.getElementById('total-detail');
  const floorCeilingInfoEl = document.getElementById('floor-ceiling-info');
  const resultTotalContainer = document.getElementById('result-total-container');
  
  // Affichage du total net
  document.getElementById('total-net-amount').textContent = formatCurrency(totalNet);
  const totalNetDetailEl = document.getElementById('total-net-detail');
  const chargesDeducted = totalBrut - totalNet;
  totalNetDetailEl.textContent = `Après déduction des cotisations sociales (${formatCurrency(chargesDeducted)} déduites).`;
  
  // Affichage du net net (après impôt)
  document.getElementById('total-net-net-amount').textContent = formatCurrency(totalNetNet);
  const totalNetNetDetailEl = document.getElementById('total-net-net-detail');
  const incomeTaxDeducted = totalNet - totalNetNet;
  const taxableAmount = preavisNet + leaveNet + primesNet;
  totalNetNetDetailEl.textContent = `Après déduction de l'impôt sur le revenu (${formatCurrency(incomeTaxDeducted)} déduits sur ${formatCurrency(taxableAmount)} soumis à l'impôt, taux ${incomeTaxRate.toFixed(1)}%). Indemnités légales/conventionnelles et supra-légale exonérées d'impôts.`;

  // Total indemnités seules (sans prime, pré-avis et congé) = légal + extra-légal
  const totalIndemnitesBrut = legalExtraAdjusted;
  const totalIndemnitesNet = legalNet + extraNet;
  const totalIndemnitesNetNet = legalNetNet + extraNetNet;
  document.getElementById('total-indemnites-brut').textContent = formatCurrency(totalIndemnitesBrut);
  document.getElementById('total-indemnites-net').textContent = formatCurrency(totalIndemnitesNet);
  document.getElementById('total-indemnites-netnet').textContent = formatCurrency(totalIndemnitesNetNet);

  // Affichage des indicateurs de plancher/plafond sur (légale + extra-légale)
  if (MIN_LEGAL_EXTRA != null && legalExtraSum < MIN_LEGAL_EXTRA) {
    totalDetailEl.textContent = `Plancher appliqué : (légale + extra-légale) relevé de ${formatCurrency(legalExtraSum)} à ${formatCurrency(MIN_LEGAL_EXTRA)} (ancienneté ${totalYears.toFixed(2)} ans).`;
    floorCeilingInfoEl.innerHTML = `<div class="floor-indicator">⚠️ Plancher de ${formatCurrency(MIN_LEGAL_EXTRA)} appliqué sur (légale + extra-légale) - ancienneté ${totalYears.toFixed(2)} ans</div>`;
    resultTotalContainer.classList.add('has-floor');
    resultTotalContainer.classList.remove('has-ceiling');
  } else if (MAX_LEGAL_EXTRA != null && legalExtraSum > MAX_LEGAL_EXTRA) {
    totalDetailEl.textContent = `Plafond appliqué : (légale + extra-légale) réduit de ${formatCurrency(legalExtraSum)} à ${formatCurrency(MAX_LEGAL_EXTRA)}.`;
    floorCeilingInfoEl.innerHTML = `<div class="ceiling-indicator">⚠️ Plafond de ${formatCurrency(MAX_LEGAL_EXTRA)} appliqué sur (légale + extra-légale)</div>`;
    resultTotalContainer.classList.add('has-ceiling');
    resultTotalContainer.classList.remove('has-floor');
  } else {
    totalDetailEl.textContent = `Aucun plancher/plafond appliqué sur (légale + extra-légale).`;
    floorCeilingInfoEl.innerHTML = '';
    resultTotalContainer.classList.remove('has-floor', 'has-ceiling');
  }
}

function handleReset() {
  const form = document.getElementById('pdv-form');
  form.reset();

  // Réinitialiser le plafond à 300k
  const ceilingInput = document.getElementById('legal-extra-ceiling');
  if (ceilingInput) {
    ceilingInput.value = 300000;
  }
  
  // Réinitialiser le taux d'allocation congé à 80%
  const leaveRateInput = document.getElementById('reclass-leave-rate');
  if (leaveRateInput) {
    leaveRateInput.value = 80;
  }

  updateLeaveSlider();

  document.getElementById('legal-amount').textContent = '0 €';
  document.getElementById('legal-detail').textContent = '';

  document.getElementById('extra-amount').textContent = '0 €';
  document.getElementById('extra-detail').textContent = '';
  const extraNetResetEl = document.getElementById('extra-net-detail');
  if (extraNetResetEl) {
    extraNetResetEl.textContent = '';
    extraNetResetEl.style.display = 'none';
  }

  document.getElementById('reclass-amount').textContent = '0 €';
  document.getElementById('reclass-detail').textContent = '';

  const sectionPeriodTotalsReset = document.getElementById('period-totals-section');
  if (sectionPeriodTotalsReset) {
    sectionPeriodTotalsReset.style.display = 'none';
    const periodIds = ['preavis-period-months', 'preavis-period-brut', 'preavis-period-net', 'preavis-period-netnet', 'preavis-period-monthly', 'leave-period-months', 'leave-repartition', 'leave-effectues-label', 'leave-effectues-brut', 'leave-effectues-net', 'leave-effectues-netnet', 'leave-effectues-monthly', 'leave-non-effectues-label', 'leave-remaining-brut', 'leave-remaining-net', 'leave-remaining-netnet', 'leave-remaining-monthly'];
    periodIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id.includes('monthly')) el.textContent = '—';
      else if (id === 'leave-repartition') el.textContent = '0 mois effectués + 0 mois non effectués';
      else if (id === 'leave-effectues-label') el.textContent = '0 mois effectués (80% du brut/mois)';
      else if (id === 'leave-non-effectues-label') el.textContent = '0 mois non effectués (64% du brut/mois)';
      else if (id.includes('months')) el.textContent = '0';
      else el.textContent = '0 €';
    });
  }

  document.getElementById('training-amount').textContent = '0 €';
  document.getElementById('training-detail').textContent = '';

  document.getElementById('business-amount').textContent = '0 €';
  document.getElementById('business-detail').textContent = '';

  document.getElementById('legal-extra-sum-amount').textContent = '0 €';
  document.getElementById('legal-extra-sum-detail').textContent = '';
  const legalExtraNetResetEl = document.getElementById('legal-extra-net-amount');
  if (legalExtraNetResetEl) {
    legalExtraNetResetEl.textContent = '';
    legalExtraNetResetEl.style.display = 'none';
  }
  const legalExtraCsgEl = document.getElementById('legal-extra-csg-detail');
  if (legalExtraCsgEl) {
    legalExtraCsgEl.textContent = '';
    legalExtraCsgEl.style.display = 'none';
  }

  document.getElementById('subtotal-amount').textContent = '0 €';

  document.getElementById('total-amount').textContent = '0 €';
  document.getElementById('total-net-amount').textContent = '0 €';
  document.getElementById('total-net-net-amount').textContent = '0 €';
  document.getElementById('total-indemnites-brut').textContent = '0 €';
  document.getElementById('total-indemnites-net').textContent = '0 €';
  document.getElementById('total-indemnites-netnet').textContent = '0 €';
  const totalDetailEl = document.getElementById('total-detail');
  const totalNetDetailEl = document.getElementById('total-net-detail');
  const totalNetNetDetailEl = document.getElementById('total-net-net-detail');
  const floorCeilingInfoEl = document.getElementById('floor-ceiling-info');
  const resultTotalContainer = document.getElementById('result-total-container');
  if (totalDetailEl) totalDetailEl.textContent = '';
  if (totalNetDetailEl) totalNetDetailEl.textContent = '';
  if (totalNetNetDetailEl) totalNetNetDetailEl.textContent = '';
  if (floorCeilingInfoEl) floorCeilingInfoEl.innerHTML = '';
  if (resultTotalContainer) {
    resultTotalContainer.classList.remove('has-floor', 'has-ceiling');
  }
  
  // Réinitialiser l'état des champs de primes
  toggleBonusFields();
  
  // Mise à jour de l'interface selon l'hypothèse
  updateHypothesisUI();
}

function toggleBonusFields() {
  const trainingEnabled = document.getElementById('training-bonus-enabled').checked;
  const businessEnabled = document.getElementById('business-creation-bonus-enabled').checked;
  
  const trainingInput = document.getElementById('training-bonus');
  const businessInput = document.getElementById('business-creation-bonus');
  
  trainingInput.disabled = !trainingEnabled;
  businessInput.disabled = !businessEnabled;
  
  if (!trainingEnabled) {
    trainingInput.style.opacity = '0.5';
    trainingInput.style.cursor = 'not-allowed';
  } else {
    trainingInput.style.opacity = '1';
    trainingInput.style.cursor = 'text';
  }
  
  if (!businessEnabled) {
    businessInput.style.opacity = '0.5';
    businessInput.style.cursor = 'not-allowed';
  } else {
    businessInput.style.opacity = '1';
    businessInput.style.cursor = 'text';
  }
}

function updateFloorBySeniority(forceUpdate = false) {
  const seniorityYears = parseNumber(document.getElementById('seniority-years'));
  const seniorityMonths = parseNumber(document.getElementById('seniority-months'));
  const totalYears = seniorityYears + seniorityMonths / 12;
  const floorInput = document.getElementById('legal-extra-floor');
  
  if (!floorInput) return;
  
  const suggestedFloor = getFloorBySeniority(totalYears);
  const currentValue = parseNumber(floorInput);
  
  const allSuggestedValues = [70000, 90000, 110000, 130000];
  
  // Vérifier si l'utilisateur a modifié manuellement le champ avec une valeur personnalisée
  const isManuallyEdited = floorInput.dataset.manualEdit === 'true';
  const isCustomValue = !allSuggestedValues.includes(currentValue) && currentValue > 0;
  
  // Mettre à jour automatiquement si :
  // 1. Force update (changement d'hypothèse)
  // 2. La valeur est 0 ou vide
  // 3. La valeur actuelle est différente du plancher suggéré ET ce n'est pas une valeur personnalisée modifiée manuellement
  const shouldUpdate = forceUpdate || 
                       currentValue === 0 || 
                       (currentValue !== suggestedFloor && !(isManuallyEdited && isCustomValue));
  
  if (shouldUpdate) {
    floorInput.value = suggestedFloor;
    // Réinitialiser le flag si on met à jour automatiquement
    if (!isCustomValue) {
      floorInput.dataset.manualEdit = 'false';
    }
  }
}

function updateHypothesisUI() {
  const multiplierInput = document.getElementById('extra-multiplier');
  const multiplierDescEl = document.getElementById('multiplier-description');
  const businessBonusInput = document.getElementById('business-creation-bonus');
  const businessBonusDescEl = document.getElementById('business-bonus-description');
  
  const seniorityYears = parseNumber(document.getElementById('seniority-years'));
  const seniorityMonths = parseNumber(document.getElementById('seniority-months'));
  const totalYears = seniorityYears + seniorityMonths / 12;
  const autoMultiplier = getMultiplierBySeniority(totalYears);
  
  if (multiplierInput) {
    const currentMultiplier = parseNumber(multiplierInput);
    const isAutoValue = currentMultiplier === 1.0 || currentMultiplier === autoMultiplier || 
                        [1.0, 1.2, 1.5].includes(currentMultiplier) ||
                        currentMultiplier === 0;
    
    if (isAutoValue) {
      multiplierInput.value = autoMultiplier.toFixed(2);
    }
  }
  
  if (multiplierDescEl) {
    multiplierDescEl.textContent = 'Multiplicateur de la tranche atteinte × toutes les années (ex. 16 ans → 1,5 × 16). Modifiable manuellement.';
  }
  
  updateFloorBySeniority(true);
  
  if (businessBonusInput) {
    const currentValue = parseNumber(businessBonusInput);
    if (currentValue === 10000 || currentValue === 20000 || currentValue === 0) {
      businessBonusInput.value = 20000;
    }
  }
  
  if (businessBonusDescEl) {
    businessBonusDescEl.textContent = 'Prime totale payée en 2 fois (€). Accord signé : 20 000 €.';
  }
}

function updateLeaveSlider() {
  const durationInput = document.getElementById('reclass-leave-months');
  const slider = document.getElementById('reclass-leave-used');
  const valueEl = document.getElementById('reclass-leave-used-value');
  const explanationEl = document.getElementById('reclass-leave-used-explanation');
  if (!durationInput || !slider || !valueEl || !explanationEl) return;

  const max = Math.max(0, parseNumber(durationInput));
  slider.max = max;
  slider.setAttribute('aria-valuemax', max);
  let used = parseInt(slider.value, 10) || 0;
  if (used > max) {
    used = max;
    slider.value = used;
  }
  valueEl.textContent = used;
  const notDone = max - used;
  const reducedPct = 64; // 80% de 80%
  if (max === 0) {
    explanationEl.textContent = 'Aucun mois de congé.';
  } else if (notDone === 0) {
    explanationEl.textContent = `${used} mois à 80% du brut (congé effectué en totalité).`;
  } else if (used === 0) {
    explanationEl.textContent = `0 mois à 80% du brut — ${notDone} mois non fait (${reducedPct}% du brut).`;
  } else {
    explanationEl.textContent = `${used} mois à 80% du brut — ${notDone} mois non fait (${reducedPct}% du brut).`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('pdv-form');
  const resetBtn = document.getElementById('reset-btn');
  const trainingCheckbox = document.getElementById('training-bonus-enabled');
  const businessCheckbox = document.getElementById('business-creation-bonus-enabled');
  const seniorityYearsInput = document.getElementById('seniority-years');
  const seniorityMonthsInput = document.getElementById('seniority-months');
  const ceilingInput = document.getElementById('legal-extra-ceiling');
  const multiplierInput = document.getElementById('extra-multiplier');

  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', handleReset);
  }
  
  // Gestion de l'activation/désactivation des champs de primes
  if (trainingCheckbox) {
    trainingCheckbox.addEventListener('change', toggleBonusFields);
  }
  if (businessCheckbox) {
    businessCheckbox.addEventListener('change', toggleBonusFields);
  }
  
  // Mise à jour automatique du plancher selon l'ancienneté
  if (seniorityYearsInput) {
    seniorityYearsInput.addEventListener('input', () => {
      updateFloorBySeniority();
      updateHypothesisUI();
    });
    seniorityYearsInput.addEventListener('change', () => {
      updateFloorBySeniority();
      updateHypothesisUI();
    });
  }
  if (seniorityMonthsInput) {
    seniorityMonthsInput.addEventListener('input', () => {
      updateFloorBySeniority();
      updateHypothesisUI();
    });
    seniorityMonthsInput.addEventListener('change', () => {
      updateFloorBySeniority();
      updateHypothesisUI();
    });
  }
  
  // Détecter si l'utilisateur modifie manuellement le plancher
  const floorInput = document.getElementById('legal-extra-floor');
  if (floorInput) {
    floorInput.addEventListener('input', () => {
      // Marquer comme modifié manuellement si l'utilisateur tape dans le champ
      floorInput.dataset.manualEdit = 'true';
    });
    floorInput.addEventListener('blur', () => {
      const allSuggestedValues = [70000, 90000, 110000, 130000];
      const currentValue = parseNumber(floorInput);
      
      if (allSuggestedValues.includes(currentValue)) {
        floorInput.dataset.manualEdit = 'false';
      }
    });
  }
  
  // Détecter si l'utilisateur modifie manuellement le multiplicateur
  if (multiplierInput) {
    multiplierInput.addEventListener('input', () => {
      // Marquer comme modifié manuellement si l'utilisateur tape dans le champ
      multiplierInput.dataset.manualEdit = 'true';
    });
    multiplierInput.addEventListener('blur', () => {
      const seniorityYears = parseNumber(document.getElementById('seniority-years'));
      const seniorityMonths = parseNumber(document.getElementById('seniority-months'));
      const totalYears = seniorityYears + seniorityMonths / 12;
      const autoMultiplier = getMultiplierBySeniority(totalYears);
      const currentValue = parseNumber(multiplierInput);
      
      if (Math.abs(currentValue - autoMultiplier) < 0.01) {
        multiplierInput.dataset.manualEdit = 'false';
      }
    });
  }
  
  // Initialisation du plafond à 300k
  if (ceilingInput && !ceilingInput.value) {
    ceilingInput.value = 300000;
  }
  
  // Curseur congé : max = durée congé, valeur = mois effectués à 80%
  const leaveMonthsInput = document.getElementById('reclass-leave-months');
  const leaveUsedSlider = document.getElementById('reclass-leave-used');
  if (leaveMonthsInput) {
    leaveMonthsInput.addEventListener('input', updateLeaveSlider);
    leaveMonthsInput.addEventListener('change', updateLeaveSlider);
  }
  if (leaveUsedSlider) {
    leaveUsedSlider.addEventListener('input', updateLeaveSlider);
    leaveUsedSlider.addEventListener('change', updateLeaveSlider);
  }
  updateLeaveSlider();

  // Initialisation de l'état des champs
  toggleBonusFields();
  updateHypothesisUI();
  
  // Mise à jour initiale du plancher si une ancienneté est déjà saisie
  updateFloorBySeniority();
  
  // Affichage de la version
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = APP_VERSION;
  }
});


