// ---------------------------------------------------------------------------
// Accès à localStorage.
// Tout est sérialisé en JSON sous des clés préfixées, pour ne pas se mélanger
// avec d'autres pages du même domaine (GitHub Pages est un domaine partagé).
// ---------------------------------------------------------------------------

const PREFIXE = "foodtracker.";

export const CLES = {
  inventaire: PREFIXE + "inventaire",   // tableau de produits
  historique: PREFIXE + "historique",   // tableau des changements de niveau
  cache: PREFIXE + "cacheProduits",     // fiches Open Food Facts, indexées par code-barres
  identifiant: PREFIXE + "uuidApp",     // identifiant anonyme envoyé à Open Food Facts
  theme: PREFIXE + "theme",             // "auto", "clair" ou "sombre"
};

// Lecture tolérante : si la clé est absente ou le JSON corrompu, on renvoie
// la valeur par défaut plutôt que de planter l'application.
export function lire(cle, valeurParDefaut) {
  try {
    const brut = localStorage.getItem(cle);
    if (brut === null) return valeurParDefaut;
    return JSON.parse(brut);
  } catch (erreur) {
    console.warn("Lecture impossible pour", cle, erreur);
    return valeurParDefaut;
  }
}

// Écriture. Peut échouer si le quota est plein ou si le navigateur est en
// navigation privée : dans ce cas on prévient franchement, c'est la seule
// sauvegarde locale.
export function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (erreur) {
    console.error("Écriture impossible pour", cle, erreur);
    alert("Sauvegarde impossible : stockage plein ou bloqué par le navigateur.");
    return false;
  }
}

// Identifiant unique d'une ligne d'inventaire.
// crypto.randomUUID n'existe qu'en contexte sécurisé (https ou localhost),
// d'où la solution de repli.
export function identifiant() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
