declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_SETUP_TOKEN?: string;
    BUCKET?: R2Bucket;
  }
}
