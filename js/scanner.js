// ---------------------------------------------------------------------------
// Pilotage de la caméra via html5-qrcode.
//
// La bibliothèque est chargée dans index.html par une balise <script> classique
// (ce n'est pas un module ES) : elle expose window.Html5Qrcode.
//
// Rappel : l'accès caméra n'est autorisé qu'en contexte sécurisé, donc en https
// ou sur http://localhost. Sur le téléphone, il faut donc passer par
// GitHub Pages (https) ; en local sur le PC, localhost suffit.
// ---------------------------------------------------------------------------

let lecteur = null; // instance en cours, null si la caméra est arrêtée

// Formats utiles pour de l'alimentaire : EAN-13 surtout, plus les variantes
// courtes (petits emballages) et américaines (UPC).
function formatsCodesBarres() {
  const F = window.Html5QrcodeSupportedFormats;
  if (!F) return undefined; // dans le doute, on laisse la bibliothèque tout tester
  return [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.UPC_EAN_EXTENSION];
}

// Zone de visée : un rectangle large et peu haut, adapté à un code-barres.
// La fonction reçoit la taille réelle de l'aperçu vidéo.
function zoneDeVisee(largeurVue, hauteurVue) {
  const largeur = Math.floor(Math.min(largeurVue, 400) * 0.9);
  const hauteur = Math.floor(Math.min(hauteurVue * 0.5, 180));
  return { width: largeur, height: hauteur };
}

// Démarre la caméra dans l'élément d'id `idElement`.
// `surDetection` est appelée avec le code lu (une seule fois : l'appelant
// arrête le scan derrière).
export async function demarrerScan(idElement, surDetection) {
  if (!window.Html5Qrcode) {
    throw new Error("bibliothèque de scan non chargée");
  }
  await arreterScan(); // sécurité : jamais deux caméras en même temps

  lecteur = new window.Html5Qrcode(idElement, {
    formatsToSupport: formatsCodesBarres(),
    verbose: false,
    // Sur Android, Chrome sait décoder les codes-barres nativement :
    // c'est nettement plus rapide que le décodage JavaScript.
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  });

  await lecteur.start(
    { facingMode: "environment" }, // caméra arrière
    { fps: 10, qrbox: zoneDeVisee },
    (texteDecode) => surDetection(texteDecode),
    () => {
      // Appelée à chaque image sans code lisible : c'est le cas normal,
      // on ignore.
    }
  );
}

// Arrêt propre : libère la caméra (sinon la LED reste allumée sur le téléphone).
export async function arreterScan() {
  if (!lecteur) return;
  const instance = lecteur;
  lecteur = null;
  try {
    await instance.stop();
    instance.clear();
  } catch (erreur) {
    console.warn("Arrêt du scanner :", erreur);
  }
}
