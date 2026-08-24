// ---------------------------------------------------------------------------
// Émoji associé à chaque catégorie, pour repérer un rayon d'un coup d'œil.
//
// Les clés doivent rester alignées sur les `libelle` de REGLES (peremption.js)
// et sur CATEGORIE_INCONNUE / CATEGORIE_MANUELLE. Une catégorie absente de la
// table retombe sur l'émoji par défaut : rien ne casse si on oublie une ligne.
// ---------------------------------------------------------------------------

const ICONES = {
  // Longue conservation
  "Conserves": "🥫",
  "Surgelés": "🧊",

  // Épicerie sucrée et condiments
  "Miel": "🍯",
  "Épices et aromates": "🌿",
  "Huiles et vinaigres": "🫒",
  "Confitures et tartinables": "🍓",
  "Sauces et condiments": "🫙",

  // Épicerie sèche
  "Pâtes": "🍝",
  "Riz et céréales": "🍚",
  "Légumes secs": "🫘",
  "Farines": "🌾",
  "Café et thé": "☕",
  "Céréales petit-déjeuner": "🥣",
  "Chocolat et confiserie": "🍫",
  "Biscuits et gâteaux": "🍪",
  "Apéritif": "🥨",
  "Boissons": "🥤",
  "Sucre et sel": "🧂",

  // Rayon frais
  "Yaourts et desserts lactés": "🍮",
  "Fromages": "🧀",
  "Crème": "🍶",
  "Beurre et margarine": "🧈",
  "Lait": "🥛",
  "Œufs": "🥚",

  // Frais périssable
  "Charcuterie": "🥓",
  "Jambon": "🍖",
  "Plats préparés": "🍱",
  "Viandes": "🥩",
  "Poissons": "🐟",
  "Pain et boulangerie": "🥖",
  "Salades et herbes": "🥬",
  "Fruits": "🍎",
  "Légumes": "🥕",

  // Fourre-tout
  "Autres": "📦",
  "Divers": "🧺",
};

const PAR_DEFAUT = "🍽️";

export function iconeDe(categorie) {
  return ICONES[categorie] || PAR_DEFAUT;
}
