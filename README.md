# Inventaire cuisine

Petite application web d'inventaire de nourriture personnel, pensée pour un
téléphone Android. Aucun build, aucun serveur applicatif : ce sont des fichiers
statiques.

## Lancer en local

```sh
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000>.

> La caméra n'est autorisée qu'en **contexte sécurisé** : `https://…` ou
> `http://localhost`. Sur le PC en localhost, elle fonctionne ; depuis le
> téléphone qui viserait l'IP du PC en `http://`, non. Pour tester le scan sur
> le téléphone, publier sur GitHub Pages (qui est en https). En attendant,
> l'écran de scan propose toujours la saisie du code à la main.

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Les trois écrans (tableau de bord, scan, formulaire) |
| `css/style.css` | Toute la mise en forme : jetons de couleur, thème clair/sombre, composants |
| `js/app.js` | Composant Alpine : état et actions |
| `js/peremption.js` | Table d'estimation des durées + code couleur |
| `js/icones.js` | Émoji par catégorie (repère visuel des rayons) |
| `js/openfoodfacts.js` | Appel API + cache des fiches |
| `js/scanner.js` | Pilotage de la caméra (html5-qrcode) |
| `js/stockage.js` | Lecture / écriture localStorage |
| `js/sauvegarde.js` | Export / import du fichier JSON |

Aucun framework CSS : `css/style.css` est autonome et s'organise en 15 sections
numérotées, la première étant les jetons de couleur (`--accent`, `--perime`…).
Changer la teinte de l'application tient donc en quelques lignes.

Bibliothèques via CDN, versions figées : Alpine.js 3.14.1, html5-qrcode 2.3.8.
La police Inter vient de Google Fonts ; sans réseau, la pile système prend le
relais.

## L'interface

- **Quatre tuiles** en haut du tableau de bord — *En stock*, *Cette semaine*,
  *Entamés*, *Périmés* — qui sont aussi des **filtres** : un tap sur une tuile
  n'affiche plus que les produits comptés dedans, un second tap revient à tout.
- **Recherche** sur le nom, la marque, la catégorie et la quantité.
- **Catégories repliables**, triées par urgence, chacune avec son émoji.
- **Carte produit** : vignette, échéance en pastille colorée (4 états), date
  corrigeable en un tap, curseur de niveau qui vire au rouge sous 25 %.
- **Thème clair / sombre / automatique**, bouton en haut à droite, mémorisé.
- Les `alert()` et `confirm()` du navigateur ont été remplacés par des
  notifications passagères et une boîte de dialogue maison.

## Régler les durées de conservation

Tout est dans le tableau `REGLES` en haut de `js/peremption.js` :

```js
{ libelle: "Conserves", jours: 730, motifs: ["conserve", "canned", ...] },
```

- `jours` : la durée estimée ;
- `motifs` : les morceaux de texte cherchés dans les catégories Open Food Facts
  (minuscules, sans accents) ;
- `libelle` : sert aussi de nom de groupe sur le dashboard.

La **première** règle qui correspond gagne : pour donner la priorité à une
règle, il suffit de la remonter dans la liste.

## Données stockées (localStorage)

- `foodtracker.inventaire` — les produits ;
- `foodtracker.historique` — un enregistrement par changement de niveau
  (`{code, id, nom, ancienNiveau, nouveauNiveau, date}`), jamais affiché ;
- `foodtracker.cacheProduits` — les fiches Open Food Facts déjà téléchargées,
  indexées par code-barres ;
- `foodtracker.uuidApp` — identifiant anonyme envoyé à Open Food Facts ;
- `foodtracker.theme` — `"auto"`, `"clair"` ou `"sombre"`.

Le bouton **Exporter** produit un fichier JSON contenant l'inventaire *et*
l'historique. C'est la seule sauvegarde : à faire régulièrement.

## Publier sur GitHub Pages

1. Créer un dépôt vide sur GitHub (par exemple `inventaire-cuisine`), sans
   README ni licence.
2. Depuis ce dossier :

   ```sh
   git remote add origin https://github.com/<utilisateur>/inventaire-cuisine.git
   git branch -M main
   git push -u origin main
   ```

3. Sur GitHub : **Settings → Pages**, section *Build and deployment* :
   *Source* = **Deploy from a branch**, *Branch* = **main**, dossier **/ (root)**,
   puis **Save**.
4. Au bout d'une minute, le site est en ligne sur
   `https://<utilisateur>.github.io/inventaire-cuisine/`.
   L'ouvrir sur le téléphone et l'ajouter à l'écran d'accueil
   (menu Chrome → *Ajouter à l'écran d'accueil*).

Tous les chemins internes sont relatifs (`./css/…`, `./js/…`) : le sous-dossier
du dépôt dans l'URL ne pose donc aucun problème.

> Un dépôt public rend le code visible, mais **pas** les données : l'inventaire
> reste dans le localStorage du téléphone.
