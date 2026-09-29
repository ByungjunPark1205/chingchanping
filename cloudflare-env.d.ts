declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_SETUP_TOKEN?: string;
    SIGNUP_ALERT_TOKEN?: string;
    BUCKET?: R2Bucket;
  }
}
