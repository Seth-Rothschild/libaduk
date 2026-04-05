const DRY_RUN = false;

db.games.find({}).forEach(game => {
  const owners = [];
  const blackExists = game.blackName && db.users.findOne({ _id: game.blackName.toLowerCase() });
  const whiteExists = game.whiteName && db.users.findOne({ _id: game.whiteName.toLowerCase() });
  if (blackExists) owners.push(game.blackName);
  if (whiteExists) owners.push(game.whiteName);

  const current = JSON.stringify(game.owners ?? []);
  const updated = JSON.stringify(owners);
  if (current !== updated) {
    print(`${game._id}: ${current} -> ${updated}`);
    if (!DRY_RUN) {
      db.games.updateOne({ _id: game._id }, { $set: { owners } });
    }
  }
});
