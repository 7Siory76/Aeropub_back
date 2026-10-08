const path = require('path');
const basePath = 'C:/Users/aina/Desktop/S6/STAGE/Aeropub_back';
require(path.join(basePath, 'node_modules/dotenv')).config({ path: path.join(basePath, '.env') });
const SupportModel = require(path.join(basePath, 'src/models/SupportModel'));

async function main() {
  try {
    const res = await SupportModel.getAll();
    console.log('Total supports:', res.length);
    console.log('Sample supports:', res.slice(0, 5).map(r => ({
      reference: r.reference,
      nom_categorie: r.nom_categorie,
      nom_type: r.nom_type,
      nom_type_support: r.nom_type_support,
      nom_zone: r.nom_zone,
      statut: r.statut,
      etat: r.etat
    })));

    const categories = {};
    const zones = {};
    res.forEach(r => {
      const cat = r.nom_categorie || 'NULL';
      categories[cat] = (categories[cat] || 0) + 1;
      const zone = r.nom_zone || 'NULL';
      zones[zone] = (zones[zone] || 0) + 1;
    });

    console.log('Categories count:', categories);
    console.log('Zones count:', zones);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
