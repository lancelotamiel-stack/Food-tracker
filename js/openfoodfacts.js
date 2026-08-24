// ---------------------------------------------------------------------------
// Interrogation de l'API Open Food Facts + cache local des fiches produit.
//
// Base collaborative : beaucoup de champs sont absents ou vides. On teste donc
// l'existence de chaque champ avant de l'utiliser, et on renvoie toujours une
// fiche à la structure fixe (chaînes vides plutôt que undefined).
// ---------------------------------------------------------------------------

import { CLES, lire, ecrire, identifiant } from "./stockage.js";

const BASE = "https://world.openfoodfacts.org/api/v2/product/";

const CHAMPS = [
  "product_name_fr",
  "product_name",
  "brands",
  "quantity",
  "product_quantity",
  "categories_tags_fr",
  "image_thumb_url",
].join(",");

// Open Food Facts demande d'identifier l'application appelante.
// ATTENTION : dans un navigateur, "User-Agent" est un en-tête interdit ; fetch()
// le supprime silencieusement. Open Food Facts recommande donc, pour les
// applications web, de passer l'identification en paramètres d'URL
// (app_name / app_version / app_uuid). C'est ce que fait identification().
const NOM_APP = "InventaireCuisine";
const VERSION_APP = "0.1";

function identification() {
  let uuid = lire(CLES.identifiant, null);
  if (typeof uuid !== "string" || uuid === "") {
    uuid = identifiant();
    ecrire(CLES.identifiant, uuid);
  }
  return (
    "app_name=" + encodeURIComponent(NOM_APP) +
    "&app_version=" + encodeURIComponent(VERSION_APP) +
    "&app_uuid=" + encodeURIComponent(uuid)
  );
}

// --- Cache -----------------------------------------------------------------
// Indexé par code-barres : un produit déjà scanné n'entraîne plus d'appel réseau.

function lireCache() {
  const cache = lire(CLES.cache, {});
  return cache && typeof cache === "object" ? cache : {};
}

export function ficheEnCache(code) {
  const cache = lireCache();
  return Object.prototype.hasOwnProperty.call(cache, code) ? cache[code] : null;
}

function mettreEnCache(code, fiche) {
  const cache = lireCache();
  cache[code] = fiche;
  ecrire(CLES.cache, cache);
}

// --- Appel API -------------------------------------------------------------

// Renvoie une fiche produit, ou null si Open Food Facts ne connaît pas le code
// (status: 0). Lève une erreur en cas de problème réseau : l'appelant décide
// alors de basculer en saisie manuelle.
export async function chercherProduit(code) {
  const enCache = ficheEnCache(code);
  if (enCache) return { ...enCache, depuisCache: true };

  const url = BASE + encodeURIComponent(code) + ".json?fields=" + CHAMPS + "&" + identification();
  const reponse = await fetch(url, { headers: { Accept: "application/json" } });
  if (!reponse.ok) throw new Error("Réponse HTTP " + reponse.status);

  const donnees = await reponse.json();

  // status: 0 = produit inconnu. On ne met pas ce résultat en cache : le produit
  // peut avoir été ajouté à la base entre-temps.
  if (!donnees || donnees.status === 0 || !donnees.product) return null;

  const fiche = normaliserFiche(code, donnees.product);
  mettreEnCache(code, fiche);
  return { ...fiche, depuisCache: false };
}

// Transforme la réponse brute d'Open Food Facts en fiche à structure fixe.
// Chaque champ est testé avant utilisation.
function normaliserFiche(code, produit) {
  return {
    code: code,
    nom: texte(produit.product_name_fr) || texte(produit.product_name),
    marque: premiereMarque(produit.brands),
    quantite: quantite(produit),
    categories: listeDeTextes(produit.categories_tags_fr),
    image: texte(produit.image_thumb_url),
    recupereLe: new Date().toISOString(),
  };
}

// Chaîne non vide, débarrassée des espaces superflus ; "" sinon.
function texte(valeur) {
  if (typeof valeur !== "string") return "";
  return valeur.trim();
}

// "brands" est une liste séparée par des virgules ; on ne garde que la première.
function premiereMarque(brands) {
  const brut = texte(brands);
  if (brut === "") return "";
  return brut.split(",")[0].trim();
}

// "quantity" est le texte lisible ("1 kg", "6 x 125 g").
// À défaut, "product_quantity" donne une valeur numérique en grammes.
function quantite(produit) {
  const lisible = texte(produit.quantity);
  if (lisible !== "") return lisible;

  const numerique = Number(produit.product_quantity);
  if (Number.isFinite(numerique) && numerique > 0) return numerique + " g";

  return "";
}

function listeDeTextes(valeur) {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((v) => typeof v === "string" && v.trim() !== "");
}
