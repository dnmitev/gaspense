// Loads DATABASE_URL from .env for local runs. In CI the variable is already
// present in the environment, and dotenv does not override existing values, so
// this is safe in both places — no dotenv CLI wrapper needed.
import "dotenv/config";
