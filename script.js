// Version de l'application (à synchroniser avec le fichier VERSION)
const APP_VERSION = '1.1.11';

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

function getFloorBySeniority(totalYears) {
  if (totalYears < 5) {
    return 60000; // 0 à 5 ans
  } else if (totalYears < 10) {
    return 80000; // 5 à 10 ans
  } else if (totalYears < 15) {
    return 100000; // 10 à 15 ans
  } else {
    return 120000; // 15 ans et +
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

function computeExtraLegal(refMonthly, totalYears, multiplier, minMonths) {
  const monthsEq = Math.max(totalYears * multiplier, minMonths);
  const amount = refMonthly * monthsEq;

  return {
    amount,
    monthsEq,
    detail: `${monthsEq.toFixed(2)} mois de salaire de référence (multiplieur ${multiplier} × ${totalYears.toFixed(
      2
    )} années, plancher ${minMonths} mois)`,
  };
}

function computeReclassification(
  refMonthly,
  preavisMonths,
  preavisRate,
  preavisUsed,
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
  // Calcul pré-avis non consommé (brut)
  const preavisRemaining = Math.max(preavisMonths - preavisUsed, 0);
  const preavisMonthlyAllowance = refMonthly * (preavisRate / 100);
  const preavisAmountBrut = preavisMonthlyAllowance * preavisRemaining;

  // Calcul congé non consommé (brut)
  // Si le congé est réduit (employé sort avant la fin), 80% de la valeur restante est payée
  const leaveRemaining = Math.max(leaveMonths - leaveUsed, 0);
  const leaveMonthlyAllowance = refMonthly * (leaveRate / 100);
  const leaveAmountRaw = leaveMonthlyAllowance * leaveRemaining;
  // Application du pourcentage de réduction si le congé est réduit (mois restants > 0)
  const leaveAmountBrut = leaveRemaining > 0 ? leaveAmountRaw * (reducedRate / 100) : leaveAmountRaw;

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
    leaveAmount: leaveAmountBrut,
    leaveAmountBrut,
    leaveAmountNet,
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

  const extraMultiplier = parseNumber(document.getElementById('extra-multiplier'));
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
  const totalYears = seniorityYears + seniorityMonths / 12;

  const legal = computeLegalIndemnity(
    refMonthly,
    seniorityYears,
    seniorityMonths,
    illFracFirst,
    illFracAfter,
    iclFracFirst,
    iclFracAfter
  );

  const extraRaw = computeExtraLegal(refMonthly, totalYears, extraMultiplier, extraMinMonths);

  // Application du plancher et plafond sur la somme légale + extra-légale
  const legalExtraSum = legal.amount + extraRaw.amount;
  const MIN_LEGAL_EXTRA = legalExtraFloor > 0 ? legalExtraFloor : null;
  const MAX_LEGAL_EXTRA = legalExtraCeiling > 0 ? legalExtraCeiling : null;
  const legalExtraAdjusted = clamp(legalExtraSum, MIN_LEGAL_EXTRA, MAX_LEGAL_EXTRA);

  const reclass = computeReclassification(
    refMonthly,
    reclassPreavisMonths,
    reclassPreavisRate,
    reclassPreavisUsed,
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
  
  // Calcul du total net (avant impôt)
  // Indemnités légales/conventionnelles : exonérées de charges (jusqu'à 96K€) et d'impôts
  // On utilise le montant après ajustement plancher/plafond, réparti proportionnellement
  const legalRatio = legalExtraSum > 0 ? legal.amount / legalExtraSum : 0;
  const extraRatio = legalExtraSum > 0 ? extraRaw.amount / legalExtraSum : 0;
  const legalAdjusted = legalRatio * legalExtraAdjusted;
  const extraAdjusted = extraRatio * legalExtraAdjusted;
  
  const legalNet = legalAdjusted; // Exonérée de charges
  
  // Indemnité supra-légale : CSG/CRDS 9,7% seulement, exonérée d'impôts
  const SUPRA_LEGAL_CSG_CRDS_RATE = 9.7;
  const extraNet = extraAdjusted - (extraAdjusted * (SUPRA_LEGAL_CSG_CRDS_RATE / 100));
  
  // Pré-avis : charges sociales normales (~21% estimé)
  // Le pré-avis est payé comme un salaire normal avec charges habituelles
  const PREAVIS_CHARGES_RATE = 21; // Estimation charges normales (CSG/CRDS + autres cotisations)
  const preavisNet = reclass.preavisAmountBrut > 0 
    ? reclass.preavisAmountBrut - (reclass.preavisAmountBrut * (PREAVIS_CHARGES_RATE / 100))
    : 0;
  
  // Allocation de reclassement : net déjà calculé (charges allégées ~13,4%)
  const leaveNet = reclass.leaveAmountNet || 0;
  
  // Primes : bruts (pas de charges spécifiques mentionnées)
  const primesNet = trainingBonus + businessCreationBonus;
  
  // Total net (avant impôt)
  const totalNet = legalNet + extraNet + preavisNet + leaveNet + primesNet;
  
  // Calcul du net net (après impôt sur le revenu)
  // Éléments exonérés d'impôts : indemnités légales/conventionnelles et supra-légale
  const legalNetNet = legalNet; // Exonérée d'impôts
  const extraNetNet = extraNet; // Exonérée d'impôts
  
  // Éléments soumis à l'impôt : pré-avis, allocation de reclassement, primes
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

  // Affichage de la somme (légale + extra-légale) ajustée
  document.getElementById('legal-extra-sum-amount').textContent = formatCurrency(legalExtraAdjusted);
  const legalExtraSumDetailEl = document.getElementById('legal-extra-sum-detail');
  if (MIN_LEGAL_EXTRA != null && legalExtraSum < MIN_LEGAL_EXTRA) {
    legalExtraSumDetailEl.textContent = `Théorique : ${formatCurrency(legalExtraSum)} → Plancher de ${formatCurrency(MIN_LEGAL_EXTRA)} appliqué (ancienneté ${totalYears.toFixed(2)} ans)`;
  } else if (MAX_LEGAL_EXTRA != null && legalExtraSum > MAX_LEGAL_EXTRA) {
    legalExtraSumDetailEl.textContent = `Théorique : ${formatCurrency(legalExtraSum)} → Plafond de ${formatCurrency(MAX_LEGAL_EXTRA)} appliqué`;
  } else {
    legalExtraSumDetailEl.textContent = `Aucun ajustement (plancher/plafond)`;
  }

  document.getElementById('reclass-amount').textContent = formatCurrency(reclass.amount);
  
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

  document.getElementById('legal-amount').textContent = '0 €';
  document.getElementById('legal-detail').textContent = '';

  document.getElementById('extra-amount').textContent = '0 €';
  document.getElementById('extra-detail').textContent = '';

  document.getElementById('reclass-amount').textContent = '0 €';
  document.getElementById('reclass-detail').textContent = '';

  document.getElementById('training-amount').textContent = '0 €';
  document.getElementById('training-detail').textContent = '';

  document.getElementById('business-amount').textContent = '0 €';
  document.getElementById('business-detail').textContent = '';

  document.getElementById('legal-extra-sum-amount').textContent = '0 €';
  document.getElementById('legal-extra-sum-detail').textContent = '';

  document.getElementById('subtotal-amount').textContent = '0 €';

  document.getElementById('total-amount').textContent = '0 €';
  document.getElementById('total-net-amount').textContent = '0 €';
  document.getElementById('total-net-net-amount').textContent = '0 €';
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

function updateFloorBySeniority() {
  const seniorityYears = parseNumber(document.getElementById('seniority-years'));
  const seniorityMonths = parseNumber(document.getElementById('seniority-months'));
  const totalYears = seniorityYears + seniorityMonths / 12;
  const floorInput = document.getElementById('legal-extra-floor');
  
  if (floorInput && (seniorityYears > 0 || seniorityMonths > 0)) {
    const suggestedFloor = getFloorBySeniority(totalYears);
    // Ne mettre à jour que si l'utilisateur n'a pas modifié manuellement la valeur
    // On vérifie si la valeur actuelle correspond à un plancher suggéré
    const currentValue = parseNumber(floorInput);
    const isSuggestedValue = [60000, 80000, 100000, 120000].includes(currentValue);
    
    if (isSuggestedValue || currentValue === 0) {
      floorInput.value = suggestedFloor;
    }
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
    seniorityYearsInput.addEventListener('input', updateFloorBySeniority);
    seniorityYearsInput.addEventListener('change', updateFloorBySeniority);
  }
  if (seniorityMonthsInput) {
    seniorityMonthsInput.addEventListener('input', updateFloorBySeniority);
    seniorityMonthsInput.addEventListener('change', updateFloorBySeniority);
  }
  
  // Initialisation du plafond à 300k
  if (ceilingInput && !ceilingInput.value) {
    ceilingInput.value = 300000;
  }
  
  // Initialisation de l'état des champs
  toggleBonusFields();
  
  // Affichage de la version
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = APP_VERSION;
  }
});


