import { Client as PgClient } from "pg";
import { config } from "./config.js";

// PostgreSQL 接続情報（DBはUTCで保存）
export const pg = new PgClient(config.db);
