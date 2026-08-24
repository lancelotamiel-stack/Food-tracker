// ---------------------------------------------------------------------------
// Export / import du fichier JSON de sauvegarde.
// C'est la seule sauvegarde de l'application : le format est volontairement
// simple et lisible à l'œil.
// ---------------------------------------------------------------------------

import { formatISO } from "./peremption.js";

export const VERSION_FORMAT = 1;

// Déclenche le téléchargement d'un fichier JSON contenant tout l'inventaire.
export function exporterFichier(inventaire, historique) {
  const donnees = {
    format: VERSION_FORMAT,
    exporteLe: new Date().toISOString(),
    inventaire: inventaire,
    historique: historique,
  };

  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // Le lien doit être dans le document pour que le clic fonctionne sur Android.
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = "inventaire-" + formatISO(new Date()) + ".json";
  document.body.appendChild(lien);
  lien.click();
  lien.remove();

  // Libération différée : certains navigateurs mobiles lisent le blob après le clic.
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Lit un fichier choisi par l'utilisateur et vérifie sa structure.
// Renvoie { inventaire, historique } ou lève une erreur explicite.
export async function lireFichier(fichier) {
  const texte = await fichier.text();

  let donnees;
  try {
    donnees = JSON.parse(texte);
  } catch (erreur) {
    throw new Error("ce n'est pas du JSON valide");
  }

  if (!donnees || typeof donnees !== "object") {
    throw new Error("contenu inattendu");
  }
  if (!Array.isArray(donnees.inventaire)) {
    throw new Error("la clé « inventaire » est absente ou n'est pas une liste");
  }

  return {
    inventaire: donnees.inventaire,
    historique: Array.isArray(donnees.historique) ? donnees.historique : [],
  };
}
