/**
 * Server entry point — starts the Express app.
 */
import app from './app';
import { validateEnv } from './config/env-validator';
import { runMigrations } from './db/migrator';

validateEnv();

const PORT = Number(process.env.PORT) || 3000;

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[migrator] Migration failed:', err);
    process.exit(1);
  });
