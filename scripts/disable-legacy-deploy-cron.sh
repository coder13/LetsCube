#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${BACKUP_FILE:-/opt/letscube/legacy-deploy-crontab.backup}"
APP_DIR="${APP_DIR:-/opt/letscube/runtime}"
ENV_FILE="${ENV_FILE:-/home/www/letscube/.env.prod}"
temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/letscube-crontab.XXXXXX")"
marker='# letscube production health repair'
repair_entry="*/10 * * * * APP_DIR=$APP_DIR ENV_FILE=$ENV_FILE $APP_DIR/scripts/repair-production-services.sh 2>&1 | logger -t letscube-repair"

cleanup() {
  rm -rf -- "$temporary_dir"
}
trap cleanup EXIT

current="$temporary_dir/current"
filtered="$temporary_dir/filtered"
crontab -l > "$current" 2> /dev/null || :

if ! grep -Fq 'scripts/deploy.sh' "$current" \
  && grep -Fqx "$repair_entry" "$current"; then
  echo "Production health repair cron is already configured."
  exit 0
fi

if [ ! -f "$BACKUP_FILE" ]; then
  install -m 0600 "$current" "$BACKUP_FILE"
fi

grep -Fv 'scripts/deploy.sh' "$current" \
  | grep -Fv "$marker" \
  | grep -Fv 'scripts/repair-production-services.sh' > "$filtered" || :
printf '%s\n%s\n' "$marker" "$repair_entry" >> "$filtered"
crontab "$filtered"
echo "Replaced the legacy deploy cron with image-safe health repair. Backup: $BACKUP_FILE"
