// Version de l'application (à synchroniser avec le fichier VERSION)
const APP_VERSION = '1.1.9';

function parseNumber(input) {
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

function computeLegalIndemnity(refMonthly, years, months, fracFirst, fracAfter) {
  const totalYears = years + months / 12;
  const cappedFirst = Math.min(totalYears, 10);
  const remaining = Math.max(totalYears - 10, 0);

  const monthsEq = cappedFirst * fracFirst + remaining * fracAfter;
  const amount = refMonthly * monthsEq;

  return {
    amount,
    monthsEq,
    totalYears,
    detail: `${monthsEq.toFixed(2)} mois de salaire de référence pour ${totalYears.toFixed(
      2
    )} ans d'ancienneté`,
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

  const fracFirst = parseNumber(document.getElementById('fraction-first'));
  const fracAfter = parseNumber(document.getElementById('fraction-after'));

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
    fracFirst,
    fracAfter
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
  
  const total = totalBrut;

  document.getElementById('legal-amount').textContent = formatCurrency(legal.amount);
  document.getElementById('legal-detail').textContent = legal.detail;

  document.getElementById('extra-amount').textContent = formatCurrency(extraRaw.amount);
  document.getElementById('extra-detail').textContent = extraRaw.detail;

  // Affichage de la somme (légale + extra-légale) ajustée
  document.getElementById('legal-extra-sum-amount').textContent = formatCurrency(legalExtraAdjusted);
  const legalExtraSumDetailEl = document.getElementById('legal-extra-sum-detail');
  if (MIN_LEGAL_EXTRA != null && legalExtraSum < MIN_LEGAL_EXTRA) {
    legalExtraSumDetailEl.textContent = `Théorique : ${formatCurrency(legalExtraSum)} → Plancher appliqué`;
  } else if (MAX_LEGAL_EXTRA != null && legalExtraSum > MAX_LEGAL_EXTRA) {
    legalExtraSumDetailEl.textContent = `Théorique : ${formatCurrency(legalExtraSum)} → Plafond appliqué`;
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
  totalNetDetailEl.textContent = `Après déduction des cotisations sociales (${formatCurrency(chargesDeducted)} déduites). Soumis à l'impôt sur le revenu selon votre tranche marginale.`;

  // Affichage des indicateurs de plancher/plafond sur (légale + extra-légale)
  if (MIN_LEGAL_EXTRA != null && legalExtraSum < MIN_LEGAL_EXTRA) {
    totalDetailEl.textContent = `Plancher appliqué : (légale + extra-légale) relevé de ${formatCurrency(legalExtraSum)} à ${formatCurrency(MIN_LEGAL_EXTRA)}.`;
    floorCeilingInfoEl.innerHTML = `<div class="floor-indicator">⚠️ Plancher de ${formatCurrency(MIN_LEGAL_EXTRA)} appliqué sur (légale + extra-légale)</div>`;
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
  const totalDetailEl = document.getElementById('total-detail');
  const totalNetDetailEl = document.getElementById('total-net-detail');
  const floorCeilingInfoEl = document.getElementById('floor-ceiling-info');
  const resultTotalContainer = document.getElementById('result-total-container');
  if (totalDetailEl) totalDetailEl.textContent = '';
  if (totalNetDetailEl) totalNetDetailEl.textContent = '';
  if (floorCeilingInfoEl) floorCeilingInfoEl.innerHTML = '';
  if (resultTotalContainer) {
    resultTotalContainer.classList.remove('has-floor', 'has-ceiling');
  }
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

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('pdv-form');
  const resetBtn = document.getElementById('reset-btn');
  const trainingCheckbox = document.getElementById('training-bonus-enabled');
  const businessCheckbox = document.getElementById('business-creation-bonus-enabled');

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
  
  // Initialisation de l'état des champs
  toggleBonusFields();
  
  // Affichage de la version
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = APP_VERSION;
  }
});


