import { seed_units } from "./seed-table-unit";

seed_units().then(async () => {
    process.exit(1);
  })
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  });